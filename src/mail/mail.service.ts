import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './providers/send-mail.provider'
import { SendWelcomeMailProvider } from './providers/send-welcome-mail.provider'
import { MailOptions } from './interfaces/mail-options.interface'

@Injectable()
export class MailService {
  constructor(
    private readonly sendMailProvider: SendMailProvider,
    private readonly sendWelcomeMailProvider: SendWelcomeMailProvider,
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
}
