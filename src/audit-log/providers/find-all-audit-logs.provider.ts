import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository, SelectQueryBuilder } from 'typeorm'
import type { Request } from 'express'
import { AuditLog } from '../entities/audit-log.entity'
import { User } from 'src/users/entities/user.entity'
import {
  AuditLogSortField,
  GetAuditLogsDto,
  SortOrder,
} from '../dto/get-audit-logs.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindAllAuditLogsProvider {
  private readonly logger = new Logger(FindAllAuditLogsProvider.name)

  constructor(
    /** inject AuditLog repository to build and paginate the list query */
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    /** inject User repository for the second-pass actor snapshot lookup */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /** inject pagination provider to build the paginated response */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of audit records, optionally filtered by entity
   * and/or action (exact match) and sorted by sortBy/order (default
   * createdAt desc). Each row is returned with a `user` snapshot of its
   * actor attached.
   */
  public async findAll(
    dto: GetAuditLogsDto,
    request: Request,
  ): Promise<Paginated<AuditLog>> {
    const qb = this.auditLogRepository.createQueryBuilder('auditLog')

    if (dto.entity) {
      qb.andWhere('auditLog.entity = :entity', { entity: dto.entity })
    }
    if (dto.action) {
      qb.andWhere('auditLog.action = :action', { action: dto.action })
    }

    this.applySort(qb, dto.sortBy ?? 'createdAt', dto.order ?? 'desc')

    this.logger.debug(
      `Finding audit logs — page=${dto.page ?? 1}, limit=${dto.limit ?? 10}, sortBy=${dto.sortBy ?? 'createdAt'}, order=${dto.order ?? 'desc'}`,
    )

    const page = await this.paginationProvider.paginateQueryBuilder(
      dto,
      qb,
      request,
    )
    await this.attachUserSnapshots(page.data)
    return page
  }

  /**
   * Applies the requested sort plus an id tiebreaker so pagination stays
   * stable when the primary sort column ties. sortBy is safe to interpolate
   * — it is constrained to AUDIT_LOG_SORT_FIELDS by @IsIn before it ever
   * reaches this method.
   */
  private applySort(
    qb: SelectQueryBuilder<AuditLog>,
    sortBy: AuditLogSortField,
    order: SortOrder,
  ): void {
    const direction = order.toUpperCase() as 'ASC' | 'DESC'
    qb.orderBy(`auditLog.${sortBy}`, direction)
    if (sortBy !== 'id') {
      qb.addOrderBy('auditLog.id', direction)
    }
  }

  /**
   * Attaches a `user` snapshot to each row in place, using one batch lookup
   * rather than a join — AuditLog carries no FK to User, so a join could
   * only ever be a best-effort left join, and paginateQueryBuilder's
   * getMany() would not hydrate its columns anyway.
   */
  private async attachUserSnapshots(rows: AuditLog[]): Promise<void> {
    const userIds = [
      ...new Set(
        rows.map((row) => row.userId).filter((id): id is number => id !== null),
      ),
    ]

    if (userIds.length === 0) {
      rows.forEach((row) => (row.user = null))
      return
    }

    const users = await this.userRepository.find({
      where: { id: In(userIds) },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const byId = new Map(users.map((user) => [user.id, user]))

    for (const row of rows) {
      if (row.userId === null) {
        row.user = null
        continue
      }
      const user = byId.get(row.userId)
      row.user = user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            deleted: false,
          }
        : {
            id: row.userId,
            firstName: null,
            lastName: null,
            email: null,
            deleted: true,
          }
    }
  }
}
