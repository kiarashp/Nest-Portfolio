import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendQuoteMessageNotificationProvider {
  constructor(
    // base mail provider that renders template and sends via nodemailer
    private readonly sendMailProvider: SendMailProvider,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Notifies the site owner that a user posted a new message on their
   * quote-request thread.
   */
  async send(payload: {
    userEmail: string
    userFirstName: string
    productName: string
    code: string
    messageBody: string
  }): Promise<void> {
    // owner's inbox comes from QUOTE_NOTIFY_EMAIL, falling back to MAIL_FROM
    // when unset — same pattern as the quote-request notification
    const ownerEmail = this.configService.get<string>('mail.quoteNotifyEmail')
    await this.sendMailProvider.send({
      to: ownerEmail!,
      subject: `[Quote message] ${payload.productName} — ${payload.code}`,
      template: 'quote-message',
      context: {
        userEmail: payload.userEmail,
        userFirstName: payload.userFirstName,
        productName: payload.productName,
        code: payload.code,
        messageBody: payload.messageBody,
      },
    })
  }
}
