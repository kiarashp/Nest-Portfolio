import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import mailConfig from './config/mail.config'
import { NodemailerProvider } from './providers/nodemailer.provider'
import { SendMailProvider } from './providers/send-mail.provider'
import { SendWelcomeMailProvider } from './providers/send-welcome-mail.provider'
import { MailService } from './mail.service'

@Module({
  imports: [ConfigModule.forFeature(mailConfig)],
  providers: [
    NodemailerProvider,
    SendMailProvider,
    SendWelcomeMailProvider,
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
