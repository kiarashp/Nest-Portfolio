import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendVerificationMailProvider {
  constructor(private readonly sendMailProvider: SendMailProvider) {}

  async sendVerification(user: {
    email: string
    firstName: string
    verificationUrl: string
  }): Promise<void> {
    await this.sendMailProvider.send({
      to: user.email,
      subject: 'Verify your email address',
      template: 'verification',
      context: {
        firstName: user.firstName,
        verificationUrl: user.verificationUrl,
      },
    })
  }
}
