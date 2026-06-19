import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './providers/send-mail.provider'
import { SendWelcomeMailProvider } from './providers/send-welcome-mail.provider'
import { SendVerificationMailProvider } from './providers/send-verification-mail.provider'
import { SendPasswordResetMailProvider } from './providers/send-password-reset-mail.provider'
import { MailOptions } from './interfaces/mail-options.interface'

@Injectable()
export class MailService {
  constructor(
    private readonly sendMailProvider: SendMailProvider,
    private readonly sendWelcomeMailProvider: SendWelcomeMailProvider,
    private readonly sendVerificationMailProvider: SendVerificationMailProvider,
    private readonly sendPasswordResetMailProvider: SendPasswordResetMailProvider,
  ) {}

  async sendMail(options: MailOptions): Promise<void> {
    return this.sendMailProvider.send(options)
  }

  async sendWelcomeMail(user: {
    email: string
    firstName: string
  }): Promise<void> {
    return this.sendWelcomeMailProvider.sendWelcome(user)
  }

  async sendVerificationMail(user: {
    email: string
    firstName: string
    verificationUrl: string
  }): Promise<void> {
    return this.sendVerificationMailProvider.sendVerification(user)
  }

  async sendPasswordResetMail(user: {
    email: string
    firstName: string
    resetUrl: string
  }): Promise<void> {
    return this.sendPasswordResetMailProvider.sendPasswordReset(user)
  }
}
