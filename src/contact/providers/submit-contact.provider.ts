import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContactSubmission } from '../entities/contact-submission.entity'
import { CreateContactDto } from '../dtos/create-contact.dto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AppEvents } from 'src/common/events/app-events'

@Injectable()
export class SubmitContactProvider {
  private readonly logger = new Logger(SubmitContactProvider.name)

  constructor(
    // repository for persisting contact form submissions
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionRepository: Repository<ContactSubmission>,
    // emits contact.submitted so the mail listener can notify the owner async
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Saves the submission to the database and emits an event so the mail listener can notify the owner. */
  async submit(dto: CreateContactDto): Promise<ContactSubmission> {
    const submission = this.contactSubmissionRepository.create(dto)
    const saved = await this.contactSubmissionRepository.save(submission)
    this.eventEmitter.emit(AppEvents.CONTACT_SUBMITTED, dto)
    this.logger.log(
      `Contact submission received — id=${saved.id}, email=${dto.email}`,
    )
    return saved
  }
}
