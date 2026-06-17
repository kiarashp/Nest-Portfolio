import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendWelcomeMailProvider {
  constructor(private readonly sendMailProvider: SendMailProvider) {}

  async sendWelcome(user: { email: string; firstName: string }): Promise<void> {
    await this.sendMailProvider.send({
      to: user.email,
      subject: 'Welcome aboard!',
      template: 'welcome',
      context: { firstName: user.firstName },
    })
  }
}
