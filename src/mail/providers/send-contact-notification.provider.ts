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
    // owner's email comes from CONTACT_NOTIFICATION_EMAIL, falling back to MAIL_FROM
    // when unset — lets MAIL_FROM stay a no-reply sender while notifications land in a real inbox
    const ownerEmail = this.configService.get<string>(
      'mail.contactNotificationEmail',
    )
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
