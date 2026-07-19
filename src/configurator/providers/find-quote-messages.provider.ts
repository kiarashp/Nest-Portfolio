import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { Request } from 'express'
import { QuoteMessage } from '../entities/quote-message.entity'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { GetQuoteMessagesDto } from '../dtos/get-quote-messages.dto'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindQuoteMessagesProvider {
  constructor(
    /** inject QuoteMessage repository to build the thread query */
    @InjectRepository(QuoteMessage)
    private readonly quoteMessagesRepository: Repository<QuoteMessage>,
    /** inject SavedConfiguration repository to stamp the last-read column */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject find-one provider for the 404 guards */
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    /** inject shared pagination provider */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated page of a thread's messages, newest first, and marks
   * the thread read for the owner by stamping userLastReadAt. The
   * owner-scoped lookup 404s for a snapshot the caller does not own. There
   * is deliberately no quoteRequestedAt guard — a snapshot without a quote
   * request simply reads as an empty page.
   */
  public async findForOwner(
    id: number,
    userId: number,
    dto: GetQuoteMessagesDto,
    request: Request,
  ): Promise<Paginated<QuoteMessage>> {
    await this.findOneSavedConfigurationProvider.findOneOwnedOrFail(id, userId)
    const page = await this.paginate(id, dto, request)
    await this.savedConfigurationsRepository.update(id, {
      userLastReadAt: new Date(),
    })
    return page
  }

  /**
   * Admin counterpart of findForOwner — unscoped by owner, stamps
   * adminLastReadAt (shared by all admins).
   */
  public async findForAdmin(
    id: number,
    dto: GetQuoteMessagesDto,
    request: Request,
  ): Promise<Paginated<QuoteMessage>> {
    await this.findOneSavedConfigurationProvider.findOneByIdOrFail(id)
    const page = await this.paginate(id, dto, request)
    await this.savedConfigurationsRepository.update(id, {
      adminLastReadAt: new Date(),
    })
    return page
  }

  /** Shared thread query — newest first with an id tiebreaker. */
  private async paginate(
    id: number,
    dto: GetQuoteMessagesDto,
    request: Request,
  ): Promise<Paginated<QuoteMessage>> {
    const qb = this.quoteMessagesRepository
      .createQueryBuilder('message')
      .where('message.savedConfigurationId = :id', { id })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')

    return await this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
