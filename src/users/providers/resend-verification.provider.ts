import {
  BadRequestException,
  Injectable,
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

    const appUrl = this.configService.get<string>('appConfig.appUrl')
    const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`

    await this.mailService.sendVerificationMail({
      email: user.email,
      firstName: user.firstName,
      verificationUrl,
    })

    return { message: 'Verification email sent' }
  }
}
