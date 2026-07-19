import { Injectable } from '@nestjs/common'
import { Request } from 'express'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { QuoteMessage } from '../entities/quote-message.entity'
import { ResolveConfigurationDto } from '../dtos/resolve-configuration.dto'
import { GetSavedConfigurationsDto } from '../dtos/get-saved-configurations.dto'
import { GetSavedConfigurationsAdminDto } from '../dtos/get-saved-configurations-admin.dto'
import { PatchSavedConfigurationStatusDto } from '../dtos/patch-saved-configuration-status.dto'
import { RequestQuoteDto } from '../dtos/request-quote.dto'
import { GetQuoteMessagesDto } from '../dtos/get-quote-messages.dto'
import { CreateQuoteMessageDto } from '../dtos/create-quote-message.dto'
import { SaveConfigurationProvider } from './save-configuration.provider'
import { FindMySavedConfigurationsProvider } from './find-my-saved-configurations.provider'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { DeleteSavedConfigurationProvider } from './delete-saved-configuration.provider'
import { RequestQuoteSavedConfigurationProvider } from './request-quote-saved-configuration.provider'
import { FindAllSavedConfigurationsAdminProvider } from './find-all-saved-configurations-admin.provider'
import { UpdateQuoteStatusProvider } from './update-quote-status.provider'
import { FindQuoteMessagesProvider } from './find-quote-messages.provider'
import { CreateQuoteMessageProvider } from './create-quote-message.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

// Thin facade for saved configurations (CONFIGURATOR.md §5.3, Phase 2):
// frozen snapshots of resolved configurations owned by registered users.
// Most operations are scoped to the calling user; the *Admin methods back
// the admin-only quote-request inbox, which is deliberately unscoped by
// owner. The message methods serve the ticket-style thread each quote
// request carries.
@Injectable()
export class SavedConfigurationsService {
  constructor(
    // re-resolves selections server-side and persists the snapshot
    private readonly saveConfigurationProvider: SaveConfigurationProvider,
    // paginated list of the caller's own snapshots
    private readonly findMySavedConfigurationsProvider: FindMySavedConfigurationsProvider,
    // owner-scoped single read (404 for missing and non-owned alike)
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    // owner-scoped hard delete
    private readonly deleteSavedConfigurationProvider: DeleteSavedConfigurationProvider,
    // owner-scoped quote request — stamps quoteRequestedAt and emits the mail event
    private readonly requestQuoteSavedConfigurationProvider: RequestQuoteSavedConfigurationProvider,
    // admin-only: paginated list of quote requests across all users
    private readonly findAllSavedConfigurationsAdminProvider: FindAllSavedConfigurationsAdminProvider,
    // admin-only: sets the quoteStatus on a quote request
    private readonly updateQuoteStatusProvider: UpdateQuoteStatusProvider,
    // paginated thread reads (owner and admin), stamping the last-read column
    private readonly findQuoteMessagesProvider: FindQuoteMessagesProvider,
    // message posts (owner and admin), with status bumps and mail events
    private readonly createQuoteMessageProvider: CreateQuoteMessageProvider,
  ) {}

  /**
   * Re-resolves the selections against the published product and stores a
   * frozen snapshot for the calling user. 400 if the resolve is invalid.
   */
  public async save(
    slug: string,
    dto: ResolveConfigurationDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    return await this.saveConfigurationProvider.save(slug, dto, activeUserId)
  }

  /**
   * Returns a paginated list of the calling user's saved configurations,
   * newest first, each carrying its unread message count.
   */
  public async findMy(
    userId: number,
    dto: GetSavedConfigurationsDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    return await this.findMySavedConfigurationsProvider.findMy(
      userId,
      dto,
      request,
    )
  }

  /**
   * Returns one of the calling user's saved configurations; 404 when the id
   * does not exist or belongs to another user.
   */
  public async findOne(
    id: number,
    userId: number,
  ): Promise<SavedConfiguration> {
    return await this.findOneSavedConfigurationProvider.findOneOwnedOrFail(
      id,
      userId,
    )
  }

  /**
   * Hard-deletes one of the calling user's saved configurations; 404 when the
   * id does not exist or belongs to another user.
   */
  public async delete(
    id: number,
    userId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    return await this.deleteSavedConfigurationProvider.delete(id, userId)
  }

  /**
   * Marks a quote as requested for one of the calling user's saved
   * configurations; 404 when the id does not exist or belongs to another
   * user, 409 if a quote was already requested. An optional message becomes
   * the first thread message.
   */
  public async requestQuote(
    id: number,
    userId: number,
    dto: RequestQuoteDto,
  ): Promise<SavedConfiguration> {
    return await this.requestQuoteSavedConfigurationProvider.requestQuote(
      id,
      userId,
      dto,
    )
  }

  /**
   * Returns a page of the caller's own quote-request thread, newest first,
   * and marks the thread read for the owner; 404 when the id does not exist
   * or belongs to another user.
   */
  public async findMessages(
    id: number,
    userId: number,
    dto: GetQuoteMessagesDto,
    request: Request,
  ): Promise<Paginated<QuoteMessage>> {
    return await this.findQuoteMessagesProvider.findForOwner(
      id,
      userId,
      dto,
      request,
    )
  }

  /**
   * Posts a message into the caller's own quote-request thread; 404 when the
   * id does not exist or belongs to another user, 400 when no quote was
   * requested.
   */
  public async createMessage(
    id: number,
    userId: number,
    dto: CreateQuoteMessageDto,
  ): Promise<QuoteMessage> {
    return await this.createQuoteMessageProvider.createForOwner(id, userId, dto)
  }

  /**
   * Admin-only: returns a paginated list of quote requests across all users,
   * newest request first. Scoped to rows where a quote was actually
   * requested (quoteRequestedAt IS NOT NULL).
   */
  public async findAllAdmin(
    dto: GetSavedConfigurationsAdminDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    return await this.findAllSavedConfigurationsAdminProvider.findAll(
      dto,
      request,
    )
  }

  /**
   * Admin-only: returns one saved configuration by id, regardless of owner;
   * 404 when the id does not exist.
   */
  public async findOneAdmin(id: number): Promise<SavedConfiguration> {
    return await this.findOneSavedConfigurationProvider.findOneByIdOrFail(id)
  }

  /**
   * Admin-only: sets the quoteStatus on a saved configuration's quote
   * request; 404 when the id does not exist, 400 when no quote was
   * requested.
   */
  public async updateStatusAdmin(
    id: number,
    dto: PatchSavedConfigurationStatusDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    return await this.updateQuoteStatusProvider.updateStatus(
      id,
      dto,
      activeUserId,
    )
  }

  /**
   * Admin-only: returns a page of any quote-request thread, newest first,
   * and marks the thread read for the admin side; 404 when the id does not
   * exist.
   */
  public async findMessagesAdmin(
    id: number,
    dto: GetQuoteMessagesDto,
    request: Request,
  ): Promise<Paginated<QuoteMessage>> {
    return await this.findQuoteMessagesProvider.findForAdmin(id, dto, request)
  }

  /**
   * Admin-only: posts a reply into any quote-request thread; 404 when the id
   * does not exist, 400 when no quote was requested.
   */
  public async createMessageAdmin(
    id: number,
    dto: CreateQuoteMessageDto,
    activeUserId: number,
  ): Promise<QuoteMessage> {
    return await this.createQuoteMessageProvider.createForAdmin(
      id,
      dto,
      activeUserId,
    )
  }
}
