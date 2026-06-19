import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendPasswordResetMailProvider {
  constructor(private readonly sendMailProvider: SendMailProvider) {}

  async sendPasswordReset(user: {
    email: string
    firstName: string
    resetUrl: string
  }): Promise<void> {
    await this.sendMailProvider.send({
      to: user.email,
      subject: 'Reset your password',
      template: 'password-reset',
      context: {
        firstName: user.firstName,
        resetUrl: user.resetUrl,
      },
    })
  }
}
