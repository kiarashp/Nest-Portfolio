import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { Request } from 'express'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { GetSavedConfigurationsAdminDto } from '../dtos/get-saved-configurations-admin.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { buildSavedConfigurationRequester } from './build-saved-configuration-requester.util'
import { CountUnreadQuoteMessagesProvider } from './count-unread-quote-messages.provider'

@Injectable()
export class FindAllSavedConfigurationsAdminProvider {
  constructor(
    /** inject SavedConfiguration repository to build the admin inbox query */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject shared pagination provider */
    private readonly paginationProvider: PaginationProvider,
    /** inject the grouped unread counter to attach unreadCount per row */
    private readonly countUnreadQuoteMessagesProvider: CountUnreadQuoteMessagesProvider,
  ) {}

  /**
   * Returns a paginated list of quote requests across all users, newest
   * request first. Always scoped to rows where a quote was actually
   * requested (quoteRequestedAt IS NOT NULL) — this is a quote-request
   * inbox, not a listing of every saved configuration. Supports optional
   * quoteStatus, quoteRequestedAt date-range, and requester email filters
   * on top of that base scope, and embeds each row's requester identity
   * plus the transient unreadCount (user messages newer than the admin's
   * last read of that thread).
   */
  public async findAll(
    dto: GetSavedConfigurationsAdminDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    const qb = this.savedConfigurationsRepository
      .createQueryBuilder('savedConfiguration')
      .leftJoinAndSelect('savedConfiguration.user', 'user')
      .where('savedConfiguration.quoteRequestedAt IS NOT NULL')

    if (dto.quoteStatus !== undefined) {
      qb.andWhere('savedConfiguration.quoteStatus = :quoteStatus', {
        quoteStatus: dto.quoteStatus,
      })
    }

    if (dto.startDate && dto.endDate) {
      qb.andWhere(
        'savedConfiguration.quoteRequestedAt BETWEEN :startDate AND :endDate',
        { startDate: dto.startDate, endDate: dto.endDate },
      )
    } else if (dto.startDate) {
      qb.andWhere('savedConfiguration.quoteRequestedAt >= :startDate', {
        startDate: dto.startDate,
      })
    } else if (dto.endDate) {
      qb.andWhere('savedConfiguration.quoteRequestedAt <= :endDate', {
        endDate: dto.endDate,
      })
    }

    if (dto.email) {
      qb.andWhere('user.email ILIKE :email', { email: `%${dto.email}%` })
    }

    qb.orderBy('savedConfiguration.quoteRequestedAt', 'DESC').addOrderBy(
      'savedConfiguration.id',
      'DESC',
    )

    const result = await this.paginationProvider.paginateQueryBuilder(
      dto,
      qb,
      request,
    )
    const unread = await this.countUnreadQuoteMessagesProvider.countUnread(
      result.data.map((item) => item.id),
      'admin',
    )
    result.data.forEach((item) => {
      item.requester = buildSavedConfigurationRequester(item.user)
      item.unreadCount = unread.get(item.id) ?? 0
    })
    return result
  }
}
