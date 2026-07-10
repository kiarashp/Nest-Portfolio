import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Request } from 'express'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { GetSavedConfigurationsDto } from '../dtos/get-saved-configurations.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindMySavedConfigurationsProvider {
  constructor(
    /** inject SavedConfiguration repository to build the list query */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject shared pagination provider */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of the calling user's own saved configurations,
   * newest first. Uses a query builder purely for the guaranteed stable
   * ordering (createdAt DESC with an id tiebreaker), the same reasoning as
   * the contact inbox list.
   */
  public async findMy(
    userId: number,
    dto: GetSavedConfigurationsDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    const qb = this.savedConfigurationsRepository
      .createQueryBuilder('savedConfiguration')
      .where('savedConfiguration.userId = :userId', { userId })
      .orderBy('savedConfiguration.createdAt', 'DESC')
      .addOrderBy('savedConfiguration.id', 'DESC')

    return await this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
