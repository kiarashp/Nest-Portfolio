import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AppEvents } from 'src/common/events/app-events'
import type { UserCreatedPayload } from 'src/common/events/app-events'
import { MailService } from 'src/mail/mail.service'

@Injectable()
export class UserEventsListener {
  private readonly logger = new Logger(UserEventsListener.name)

  constructor(
    // sends transactional email triggered by user lifecycle events
    private readonly mailService: MailService,
  ) {}

  /** Sends the email verification link after a new user registers. */
  @OnEvent(AppEvents.USER_CREATED)
  async handleUserCreated(payload: UserCreatedPayload): Promise<void> {
    try {
      await this.mailService.sendVerificationMail(payload)
      this.logger.log(`Verification email sent — to=${payload.email}`)
    } catch (error) {
      this.logger.error(
        `Failed to send verification email — to=${payload.email}`,
        (error as Error).stack,
      )
    }
  }
}
