import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContactSubmission } from './entities/contact-submission.entity'
import { SubmitContactProvider } from './providers/submit-contact.provider'
import { FindAllContactSubmissionsProvider } from './providers/find-all-contact-submissions.provider'
import { FindOneContactSubmissionProvider } from './providers/find-one-contact-submission.provider'
import { UpdateContactSubmissionProvider } from './providers/update-contact-submission.provider'
import { ContactService } from './providers/contact.service'
import { ContactController } from './contact.controller'
import { MailModule } from 'src/mail/mail.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { AuditLogModule } from 'src/audit-log/audit-log.module'
import { ContactEventsListener } from './listeners/contact-events.listener'

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactSubmission]),
    MailModule,
    PaginationModule,
    AuditLogModule,
  ],
  controllers: [ContactController],
  providers: [
    SubmitContactProvider,
    FindAllContactSubmissionsProvider,
    FindOneContactSubmissionProvider,
    UpdateContactSubmissionProvider,
    ContactService,
    ContactEventsListener,
  ],
})
export class ContactModule {}
