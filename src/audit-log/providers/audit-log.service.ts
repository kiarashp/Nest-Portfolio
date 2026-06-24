import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import { AuditLog } from '../entities/audit-log.entity'
import { AuditAction } from '../enums/audit-action.enum'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { GetAuditLogsDto } from '../dto/get-audit-logs.dto'

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(
    /** inject AuditLog repository for persisting and querying audit records */
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    /** inject pagination provider to build paginated list responses */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Writes a single audit record. Best-effort: if the save fails, the error is
   * logged but never thrown so the caller's real operation is unaffected.
   */
  public async log(
    userId: number | null,
    action: AuditAction,
    entity: string,
    entityId: number,
  ): Promise<void> {
    try {
      await this.auditLogRepository.save({ userId, action, entity, entityId })
    } catch (error) {
      this.logger.error(
        `Failed to write audit log — action=${action}, entity=${entity}, entityId=${entityId}`,
        (error as Error).stack,
      )
    }
  }

  /**
   * Returns a paginated list of audit records. Optionally filtered by entity
   * name and/or action string — both comparisons are exact.
   */
  public async findAll(dto: GetAuditLogsDto): Promise<Paginated<AuditLog>> {
    const where: FindOptionsWhere<AuditLog> = {}
    if (dto.entity) where.entity = dto.entity
    if (dto.action) where.action = dto.action
    return this.paginationProvider.paginateQuery(
      dto,
      this.auditLogRepository,
      where,
    )
  }
}
