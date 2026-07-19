import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { QuoteMessage } from '../entities/quote-message.entity'
import { QuoteMessageSenderRole } from '../enums/quote-message-sender-role.enum'
import { QuoteStatus } from '../enums/quote-status.enum'
import { RequestQuoteDto } from '../dtos/request-quote.dto'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { AppEvents } from 'src/common/events/app-events'
import { User } from 'src/users/entities/user.entity'

@Injectable()
export class RequestQuoteSavedConfigurationProvider {
  private readonly logger = new Logger(
    RequestQuoteSavedConfigurationProvider.name,
  )

  constructor(
    /** inject SavedConfiguration repository to stamp quoteRequestedAt */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject QuoteMessage repository to store the optional first message */
    @InjectRepository(QuoteMessage)
    private readonly quoteMessagesRepository: Repository<QuoteMessage>,
    /** inject User repository for the email-recipient lookup (registered
     * directly in ConfiguratorModule, same pattern AdminModule uses for
     * read-only cross-cutting access to a foreign entity) */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /** inject find-one provider for the owner-scoped 404 guard */
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    /** inject audit log service to record the mutation */
    private readonly auditLogService: AuditLogService,
    /** inject event emitter to trigger the async quote-request email */
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Marks a quote as requested for one of the calling user's saved
   * configurations. The owner-scoped lookup 404s for a snapshot the caller
   * does not own. A second call 409s — the idempotency check runs before any
   * mutation, save, audit log, or event emit, so a repeat call never
   * re-triggers the notification email. Sets quoteStatus to PENDING in the
   * same save that stamps quoteRequestedAt (invariant: the two are null
   * together). An optional message becomes the first thread message and
   * rides inside the quote-request email — the posted-by-user message event
   * is deliberately not emitted here, so no second email goes out.
   */
  public async requestQuote(
    id: number,
    userId: number,
    dto: RequestQuoteDto,
  ): Promise<SavedConfiguration> {
    const savedConfiguration =
      await this.findOneSavedConfigurationProvider.findOneOwnedOrFail(
        id,
        userId,
      )

    if (savedConfiguration.quoteRequestedAt) {
      throw new ConflictException(
        'A quote has already been requested for this saved configuration',
      )
    }

    savedConfiguration.quoteRequestedAt = new Date()
    savedConfiguration.quoteStatus = QuoteStatus.PENDING
    const updated =
      await this.savedConfigurationsRepository.save(savedConfiguration)
    this.logger.log(
      `Quote requested — savedConfigurationId=${id}, userId=${userId}`,
    )
    await this.auditLogService.log(
      userId,
      AuditAction.UPDATE,
      'SavedConfiguration',
      id,
    )

    if (dto.message) {
      const message = await this.quoteMessagesRepository.save(
        this.quoteMessagesRepository.create({
          savedConfigurationId: id,
          senderId: userId,
          senderRole: QuoteMessageSenderRole.USER,
          body: dto.message,
        }),
      )
      await this.auditLogService.log(
        userId,
        AuditAction.CREATE,
        'QuoteMessage',
        message.id,
      )
    }

    // the owning user's row is guaranteed to exist by the userId FK
    const user = await this.userRepository.findOneBy({ id: userId })
    this.eventEmitter.emit(AppEvents.QUOTE_REQUESTED, {
      savedConfigurationId: updated.id,
      userEmail: user!.email,
      userFirstName: user!.firstName,
      productName: updated.productName,
      code: updated.code,
      summary: updated.summary,
      message: dto.message ?? null,
    })

    return updated
  }
}
