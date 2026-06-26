import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { CreateUserDto } from '../dtos/create-user.dtos'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AppEvents, UserCreatedPayload } from 'src/common/events/app-events'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateUserProvider {
  private readonly logger = new Logger(CreateUserProvider.name)

  constructor(
    /**
     * Injecting UserRepository
     */
    @InjectRepository(User)
    private userRepository: Repository<User>,

    /**
     * Inject Hashing provider
     */
    @Inject(HashingProvider)
    private readonly hashingProvider: HashingProvider,

    // emits user.created so the mail listener can send the verification email async
    private readonly eventEmitter: EventEmitter2,

    private readonly configService: ConfigService,

    /** inject audit log service to record new user registrations */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Create a new user
   */
  public async craeteUser(createUserDto: CreateUserDto) {
    //check if user exist with the smae email
    let existingUser: User | null = null
    try {
      existingUser = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        {
          description: 'Error connecting to database',
        },
      )
    }

    //handle execption
    if (existingUser) {
      this.logger.warn(
        `Registration rejected: email already in use — email=${createUserDto.email}`,
      )
      throw new BadRequestException('User already exist')
    }
    //create a new user
    let newUser: User | null = null
    try {
      newUser = this.userRepository.create({
        ...createUserDto,
        password: await this.hashingProvider.hashPassword(
          createUserDto.password,
        ),
        role: UserRole.USER,
      })

      await this.userRepository.save(newUser)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        {
          description: 'Error connecting to database',
        },
      )
    }
    const token = randomBytes(32).toString('hex')
    newUser.isEmailVerified = false
    newUser.emailVerificationToken = token
    newUser.emailVerificationTokenExpiry = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    )
    try {
      await this.userRepository.save(newUser)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    const frontendUrl = this.configService.get<string>('appConfig.frontendUrl')
    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`

    this.eventEmitter.emit(AppEvents.USER_CREATED, {
      email: newUser.email,
      firstName: newUser.firstName,
      verificationUrl,
    } satisfies UserCreatedPayload)

    this.logger.log(
      `User registered — userId=${newUser.id}, email=${newUser.email}`,
    )
    // userId is null because the registration is self-service — there is no acting admin
    await this.auditLogService.log(null, AuditAction.CREATE, 'User', newUser.id)
    return newUser
  }
}
