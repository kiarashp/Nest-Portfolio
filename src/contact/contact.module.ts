import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContactSubmission } from './entities/contact-submission.entity'
import { ContactProvider } from './providers/contact.provider'
import { ContactController } from './contact.controller'
import { MailModule } from 'src/mail/mail.module'

@Module({
  imports: [TypeOrmModule.forFeature([ContactSubmission]), MailModule],
  controllers: [ContactController],
  providers: [ContactProvider],
})
export class ContactModule {}
