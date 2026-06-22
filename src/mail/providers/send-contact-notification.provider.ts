import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendContactNotificationProvider {
  constructor(
    // base mail provider that renders template and sends via nodemailer
    private readonly sendMailProvider: SendMailProvider,
    private readonly configService: ConfigService,
  ) {}

  /** Sends a contact form notification email to the site owner. */
  async send(submission: {
    name: string
    email: string
    subject: string
    message: string
  }): Promise<void> {
    // owner's email comes from MAIL_FROM — the owner receives their own contact notifications
    const ownerEmail = this.configService.get<string>('mail.defaultFrom')
    await this.sendMailProvider.send({
      to: ownerEmail!,
      subject: `[Contact] ${submission.subject}`,
      template: 'contact',
      context: {
        name: submission.name,
        email: submission.email,
        subject: submission.subject,
        message: submission.message,
      },
    })
  }
}
