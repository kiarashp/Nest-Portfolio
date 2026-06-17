import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { CreateUserDto } from '../dtos/create-user.dtos'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { HashingProvider } from 'src/auth/providers/hashing.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { MailService } from 'src/mail/mail.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class CreateUserProvider {
  constructor(
    /**
     * Injecting UserRepository
     */
    @InjectRepository(User)
    private userRepository: Repository<User>,

    /**
     * Inject Hashing provider
     */
    @Inject(forwardRef(() => HashingProvider))
    private readonly hashingProvider: HashingProvider,

    private readonly mailService: MailService,

    private readonly configService: ConfigService,
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
    if (existingUser) throw new BadRequestException('User already exist')
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

    const appUrl = this.configService.get<string>('appConfig.appUrl')
    const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`

    await this.mailService.sendVerificationMail({
      email: newUser.email,
      firstName: newUser.firstName,
      verificationUrl,
    })

    return newUser
  }
}
