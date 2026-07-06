import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { Request } from 'express'
import { ContactSubmission } from '../entities/contact-submission.entity'
import { GetContactSubmissionsDto } from '../dtos/get-contact-submissions.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindAllContactSubmissionsProvider {
  constructor(
    /**
     * inject `ContactSubmission` repository
     */
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionRepository: Repository<ContactSubmission>,
    /**
     * inject pagination provider
     */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of contact submissions, newest first. Supports
   * optional filtering by the `handled` flag and by a `createdAt` date range.
   * Uses a QueryBuilder (via paginateQueryBuilder) rather than the simple
   * where-based pagination path so the ordering is explicit and guaranteed —
   * the plain paginateQuery path has no order guarantee at all.
   */
  public async findAll(
    dto: GetContactSubmissionsDto,
    request: Request,
  ): Promise<Paginated<ContactSubmission>> {
    const qb =
      this.contactSubmissionRepository.createQueryBuilder('contactSubmission')

    if (dto.handled !== undefined) {
      qb.andWhere('contactSubmission.handled = :handled', {
        handled: dto.handled,
      })
    }

    if (dto.startDate && dto.endDate) {
      qb.andWhere(
        'contactSubmission.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
      )
    } else if (dto.startDate) {
      qb.andWhere('contactSubmission.createdAt >= :startDate', {
        startDate: dto.startDate,
      })
    } else if (dto.endDate) {
      qb.andWhere('contactSubmission.createdAt <= :endDate', {
        endDate: dto.endDate,
      })
    }

    qb.orderBy('contactSubmission.createdAt', 'DESC').addOrderBy(
      'contactSubmission.id',
      'DESC',
    )

    return await this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
