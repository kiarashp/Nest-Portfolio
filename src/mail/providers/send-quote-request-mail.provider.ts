import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SendMailProvider } from './send-mail.provider'

@Injectable()
export class SendQuoteRequestMailProvider {
  constructor(
    // base mail provider that renders template and sends via nodemailer
    private readonly sendMailProvider: SendMailProvider,
    private readonly configService: ConfigService,
  ) {}

  /** Sends a configurator quote-request notification email to the site owner. */
  async send(request: {
    userEmail: string
    userFirstName: string
    productName: string
    code: string
    summary: string[]
  }): Promise<void> {
    // owner's email comes from QUOTE_NOTIFY_EMAIL, falling back to MAIL_FROM
    // when unset — lets MAIL_FROM stay a no-reply sender while notifications land in a real inbox
    const ownerEmail = this.configService.get<string>('mail.quoteNotifyEmail')
    await this.sendMailProvider.send({
      to: ownerEmail!,
      subject: `[Quote request] ${request.productName} — ${request.code}`,
      template: 'quote-request',
      context: {
        userEmail: request.userEmail,
        userFirstName: request.userFirstName,
        productName: request.productName,
        code: request.code,
        summary: request.summary,
      },
    })
  }
}
