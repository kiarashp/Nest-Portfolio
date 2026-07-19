import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendQuoteReplyMailProvider {
  constructor(
    // base mail provider that renders template and sends via nodemailer
    private readonly sendMailProvider: SendMailProvider,
  ) {}

  /**
   * Notifies the thread owner that an admin replied on their quote-request
   * thread. Unlike the owner-bound notifications, this one goes to the
   * user's own email address, so no config lookup is needed.
   */
  async send(payload: {
    userEmail: string
    userFirstName: string
    productName: string
    code: string
    messageBody: string
  }): Promise<void> {
    await this.sendMailProvider.send({
      to: payload.userEmail,
      subject: `[Quote reply] ${payload.productName} — ${payload.code}`,
      template: 'quote-reply',
      context: {
        userFirstName: payload.userFirstName,
        productName: payload.productName,
        code: payload.code,
        messageBody: payload.messageBody,
      },
    })
  }
}
