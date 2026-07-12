import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AppEvents } from 'src/common/events/app-events'
import type { QuoteRequestedPayload } from 'src/common/events/app-events'
import { MailService } from 'src/mail/mail.service'

@Injectable()
export class QuoteEventsListener {
  private readonly logger = new Logger(QuoteEventsListener.name)

  constructor(
    // sends the quote-request notification email to the site owner
    private readonly mailService: MailService,
  ) {}

  /** Emails the site owner when a user requests a quote for a saved configuration. */
  @OnEvent(AppEvents.QUOTE_REQUESTED)
  async handleQuoteRequested(payload: QuoteRequestedPayload): Promise<void> {
    try {
      await this.mailService.sendQuoteRequestMail(payload)
      this.logger.log(
        `Quote request notification sent — savedConfigurationId=${payload.savedConfigurationId}`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to send quote request notification — savedConfigurationId=${payload.savedConfigurationId}`,
        (error as Error).stack,
      )
    }
  }
}
