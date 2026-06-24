import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AppEvents } from 'src/common/events/app-events'
import { CreateContactDto } from '../dtos/create-contact.dto'
import { MailService } from 'src/mail/mail.service'

@Injectable()
export class ContactEventsListener {
  constructor(
    // sends the contact notification email to the site owner
    private readonly mailService: MailService,
  ) {}

  /** Emails the site owner when a contact form submission is saved. */
  @OnEvent(AppEvents.CONTACT_SUBMITTED)
  async handleContactSubmitted(payload: CreateContactDto): Promise<void> {
    await this.mailService.sendContactNotification(payload)
  }
}
