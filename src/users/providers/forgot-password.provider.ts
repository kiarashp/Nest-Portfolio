import { Injectable, Logger, RequestTimeoutException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { User } from '../entities/user.entity'
import { MailService } from 'src/mail/mail.service'

// Always return the same message so nobody can tell which emails are registered
const GENERIC_RESPONSE = {
  message: 'If that email is registered, you will receive a reset link',
}

@Injectable()
export class ForgotPasswordProvider {
  private readonly logger = new Logger(ForgotPasswordProvider.name)

  constructor(
    // access the users table
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    // send the reset email
    private readonly mailService: MailService,

    // read the frontend URL to build the reset link
    private readonly configService: ConfigService,
  ) {}

  /**
   * Start the password reset flow for the given email.
   * Always returns the same response whether the email exists or not.
   */
  public async forgotPassword(email: string): Promise<{ message: string }> {
    let user: User | null = null
    try {
      user = await this.userRepository.findOneBy({ email })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    // Return early without revealing whether the email is registered
    if (!user || !user.password) {
      this.logger.log(
        'Password reset requested for unknown or Google-only email — generic response sent',
      )
      return GENERIC_RESPONSE
    }

    const token = randomBytes(32).toString('hex')
    user.passwordResetToken = token
    // Token expires in 1 hour
    user.passwordResetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

    try {
      await this.userRepository.save(user)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    const frontendUrl = this.configService.get<string>('appConfig.frontendUrl')
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`

    await this.mailService.sendPasswordResetMail({
      email: user.email,
      firstName: user.firstName,
      resetUrl,
    })

    this.logger.log(`Password reset email sent — userId=${user.id}`)
    return GENERIC_RESPONSE
  }
}
