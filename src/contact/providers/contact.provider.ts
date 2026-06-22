import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContactSubmission } from '../entities/contact-submission.entity'
import { CreateContactDto } from '../dtos/create-contact.dto'
import { MailService } from 'src/mail/mail.service'

@Injectable()
export class ContactProvider {
  constructor(
    // repository for persisting contact form submissions
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionRepository: Repository<ContactSubmission>,
    // sends notification email to the site owner after each submission
    private readonly mailService: MailService,
  ) {}

  /** Saves the submission to the database and emails the site owner. */
  async submit(dto: CreateContactDto): Promise<ContactSubmission> {
    const submission = this.contactSubmissionRepository.create(dto)
    const saved = await this.contactSubmissionRepository.save(submission)
    await this.mailService.sendContactNotification(dto)
    return saved
  }
}
