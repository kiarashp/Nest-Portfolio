import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { User } from '../entities/user.entity'
import { MailService } from 'src/mail/mail.service'

@Injectable()
export class ResendVerificationProvider {
  private readonly logger = new Logger(ResendVerificationProvider.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  public async resend(email: string): Promise<{ message: string }> {
    let user: User | null = null
    try {
      user = await this.userRepository.findOneBy({ email })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    if (!user) {
      throw new BadRequestException('No account found with this email address')
    }

    if (user.isEmailVerified) {
      this.logger.log(
        `Resend verification skipped: already verified — userId=${user.id}`,
      )
      return { message: 'Email is already verified' }
    }

    const token = randomBytes(32).toString('hex')
    user.emailVerificationToken = token
    user.emailVerificationTokenExpiry = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    )

    try {
      await this.userRepository.save(user)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    const frontendUrl = this.configService.get<string>('appConfig.frontendUrl')
    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`

    await this.mailService.sendVerificationMail({
      email: user.email,
      firstName: user.firstName,
      verificationUrl,
    })

    this.logger.log(`Verification email resent — userId=${user.id}`)
    return { message: 'Verification email sent' }
  }
}
