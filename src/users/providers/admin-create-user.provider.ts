import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { User } from '../entities/user.entity'
import { AdminCreateUserDto } from '../dtos/admin-create-user.dto'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AppEvents, UserCreatedPayload } from 'src/common/events/app-events'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class AdminCreateUserProvider {
  private readonly logger = new Logger(AdminCreateUserProvider.name)

  constructor(
    /**
     * inject `User` repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    // hashes the password supplied by the admin
    @Inject(HashingProvider)
    private readonly hashingProvider: HashingProvider,

    // emits user.created so the mail listener can send the verification email
    // async, only when the admin leaves the user unverified
    private readonly eventEmitter: EventEmitter2,

    private readonly configService: ConfigService,

    /** inject audit log service to record the creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new user on behalf of an admin, with an explicit role and
   * verification status. If left unverified, the user goes through the same
   * token-based email verification flow as a self-registered user. Only
   * callable by an ADMIN (enforced at the route level). The acting admin's id
   * is recorded in the audit log as the actor, unlike self-registration which
   * logs no actor.
   */
  public async adminCreateUser(
    dto: AdminCreateUserDto,
    activeUserId: number,
  ): Promise<User> {
    let existingUser: User | null = null
    try {
      existingUser = await this.userRepository.findOne({
        where: { email: dto.email },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    if (existingUser) {
      throw new BadRequestException(
        `Email ${dto.email} is already in use by another account`,
      )
    }

    const isEmailVerified = dto.isEmailVerified ?? false

    let newUser: User | null = null
    try {
      newUser = this.userRepository.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: await this.hashingProvider.hashPassword(dto.password),
        role: dto.role ?? UserRole.USER,
        isEmailVerified,
      })
      await this.userRepository.save(newUser)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    if (!isEmailVerified) {
      const token = randomBytes(32).toString('hex')
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

      const frontendUrl = this.configService.get<string>(
        'appConfig.frontendUrl',
      )
      const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`

      this.eventEmitter.emit(AppEvents.USER_CREATED, {
        email: newUser.email,
        firstName: newUser.firstName,
        verificationUrl,
      } satisfies UserCreatedPayload)
    }

    this.logger.log(
      `User created by admin — userId=${newUser.id}, email=${newUser.email}, role=${newUser.role}, isEmailVerified=${isEmailVerified}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.CREATE,
      'User',
      newUser.id,
    )
    return newUser
  }
}
