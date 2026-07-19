import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { QuoteMessage } from '../entities/quote-message.entity'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { CreateQuoteMessageDto } from '../dtos/create-quote-message.dto'
import { QuoteMessageSenderRole } from '../enums/quote-message-sender-role.enum'
import { QuoteStatus } from '../enums/quote-status.enum'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { AppEvents } from 'src/common/events/app-events'
import type { QuoteMessagePostedPayload } from 'src/common/events/app-events'
import { User } from 'src/users/entities/user.entity'

@Injectable()
export class CreateQuoteMessageProvider {
  constructor(
    /** inject QuoteMessage repository to persist new messages */
    @InjectRepository(QuoteMessage)
    private readonly quoteMessagesRepository: Repository<QuoteMessage>,
    /** inject SavedConfiguration repository for the status bumps */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject User repository to resolve the thread owner's email/name for
     * the user-message notification (the owner-scoped lookup does not load
     * the user relation) */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /** inject find-one provider for the 404 guards */
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    /** inject audit log service to record the message creation */
    private readonly auditLogService: AuditLogService,
    /** inject event emitter to trigger the async notification email */
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Posts a message into the caller's own quote-request thread. 404 when the
   * snapshot is missing or foreign, 400 when no quote was ever requested (a
   * thread only exists on a quote request). A user message always moves the
   * status back to PENDING — it reopens both ANSWERED and CLOSED, since the
   * ball is now in the admin's court. The status bump deliberately writes no
   * SavedConfiguration audit row of its own; the message's CREATE row covers
   * the action.
   */
  public async createForOwner(
    id: number,
    userId: number,
    dto: CreateQuoteMessageDto,
  ): Promise<QuoteMessage> {
    const savedConfiguration =
      await this.findOneSavedConfigurationProvider.findOneOwnedOrFail(
        id,
        userId,
      )
    this.assertQuoteRequested(savedConfiguration)

    const message = await this.quoteMessagesRepository.save(
      this.quoteMessagesRepository.create({
        savedConfigurationId: id,
        senderId: userId,
        senderRole: QuoteMessageSenderRole.USER,
        body: dto.body,
      }),
    )

    if (savedConfiguration.quoteStatus !== QuoteStatus.PENDING) {
      savedConfiguration.quoteStatus = QuoteStatus.PENDING
      await this.savedConfigurationsRepository.save(savedConfiguration)
    }

    await this.auditLogService.log(
      userId,
      AuditAction.CREATE,
      'QuoteMessage',
      message.id,
    )

    // the owning user's row is guaranteed to exist by the userId FK
    const user = await this.userRepository.findOneBy({ id: userId })
    this.eventEmitter.emit(AppEvents.QUOTE_MESSAGE_POSTED_BY_USER, {
      savedConfigurationId: id,
      userEmail: user!.email,
      userFirstName: user!.firstName,
      productName: savedConfiguration.productName,
      code: savedConfiguration.code,
      messageBody: message.body,
    } satisfies QuoteMessagePostedPayload)

    return message
  }

  /**
   * Posts an admin reply into any user's quote-request thread. Same 404/400
   * guards as createForOwner. An admin reply moves PENDING to ANSWERED only —
   * a CLOSED thread stays closed (reopening is the user's message or a manual
   * admin PATCH). The thread owner is emailed via the posted-by-admin event.
   */
  public async createForAdmin(
    id: number,
    dto: CreateQuoteMessageDto,
    activeUserId: number,
  ): Promise<QuoteMessage> {
    // the admin lookup loads the user relation, so the owner's email/name
    // for the notification need no extra query
    const savedConfiguration =
      await this.findOneSavedConfigurationProvider.findOneByIdOrFail(id)
    this.assertQuoteRequested(savedConfiguration)

    const message = await this.quoteMessagesRepository.save(
      this.quoteMessagesRepository.create({
        savedConfigurationId: id,
        senderId: activeUserId,
        senderRole: QuoteMessageSenderRole.ADMIN,
        body: dto.body,
      }),
    )

    if (savedConfiguration.quoteStatus === QuoteStatus.PENDING) {
      savedConfiguration.quoteStatus = QuoteStatus.ANSWERED
      await this.savedConfigurationsRepository.save(savedConfiguration)
    }

    await this.auditLogService.log(
      activeUserId,
      AuditAction.CREATE,
      'QuoteMessage',
      message.id,
    )

    this.eventEmitter.emit(AppEvents.QUOTE_MESSAGE_POSTED_BY_ADMIN, {
      savedConfigurationId: id,
      userEmail: savedConfiguration.user.email,
      userFirstName: savedConfiguration.user.firstName,
      productName: savedConfiguration.productName,
      code: savedConfiguration.code,
      messageBody: message.body,
    } satisfies QuoteMessagePostedPayload)

    return message
  }

  /** A thread only exists once a quote was requested — 400 otherwise. */
  private assertQuoteRequested(savedConfiguration: SavedConfiguration): void {
    if (!savedConfiguration.quoteRequestedAt) {
      throw new BadRequestException(
        'A quote has not been requested for this saved configuration',
      )
    }
  }
}
