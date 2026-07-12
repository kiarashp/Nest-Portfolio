import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import mailConfig from './config/mail.config'
import { NodemailerProvider } from './providers/nodemailer.provider'
import { SendMailProvider } from './providers/send-mail.provider'
import { SendWelcomeMailProvider } from './providers/send-welcome-mail.provider'
import { SendVerificationMailProvider } from './providers/send-verification-mail.provider'
import { SendPasswordResetMailProvider } from './providers/send-password-reset-mail.provider'
import { SendContactNotificationProvider } from './providers/send-contact-notification.provider'
import { SendQuoteRequestMailProvider } from './providers/send-quote-request-mail.provider'
import { MailService } from './mail.service'

@Module({
  imports: [ConfigModule.forFeature(mailConfig)],
  providers: [
    NodemailerProvider,
    SendMailProvider,
    SendWelcomeMailProvider,
    SendVerificationMailProvider,
    SendPasswordResetMailProvider,
    SendContactNotificationProvider,
    SendQuoteRequestMailProvider,
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
