import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { Request } from 'express'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { GetSavedConfigurationsAdminDto } from '../dtos/get-saved-configurations-admin.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindAllSavedConfigurationsAdminProvider {
  constructor(
    /** inject SavedConfiguration repository to build the admin inbox query */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject shared pagination provider */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of quote requests across all users, newest
   * request first. Always scoped to rows where a quote was actually
   * requested (quoteRequestedAt IS NOT NULL) — this is a quote-request
   * inbox, not a listing of every saved configuration. Supports an optional
   * quoteReviewed filter on top of that base scope.
   */
  public async findAll(
    dto: GetSavedConfigurationsAdminDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    const qb = this.savedConfigurationsRepository
      .createQueryBuilder('savedConfiguration')
      .where('savedConfiguration.quoteRequestedAt IS NOT NULL')

    if (dto.quoteReviewed !== undefined) {
      qb.andWhere('savedConfiguration.quoteReviewed = :quoteReviewed', {
        quoteReviewed: dto.quoteReviewed,
      })
    }

    qb.orderBy('savedConfiguration.quoteRequestedAt', 'DESC').addOrderBy(
      'savedConfiguration.id',
      'DESC',
    )

    return await this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
