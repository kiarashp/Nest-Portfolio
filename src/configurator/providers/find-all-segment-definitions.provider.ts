import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Request } from 'express'
import { SegmentDefinition } from '../entities/segment-definition.entity'
import { GetSegmentDefinitionsDto } from '../dtos/get-segment-definitions.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindAllSegmentDefinitionsProvider {
  constructor(
    /** inject SegmentDefinition repository to build the list query */
    @InjectRepository(SegmentDefinition)
    private readonly segmentDefinitionsRepository: Repository<SegmentDefinition>,
    /** inject shared pagination provider */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of segment definitions, ordered by name. Does not
   * load options — the library list view is metadata-only, options are included
   * on the single-record read (GET /configurator-definitions/:id).
   */
  public async findAll(
    dto: GetSegmentDefinitionsDto,
    request: Request,
  ): Promise<Paginated<SegmentDefinition>> {
    const qb = this.segmentDefinitionsRepository
      .createQueryBuilder('segmentDefinition')
      .orderBy('segmentDefinition.name', 'ASC')
      .addOrderBy('segmentDefinition.id', 'ASC')

    return await this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
