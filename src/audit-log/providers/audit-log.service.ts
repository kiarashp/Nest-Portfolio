import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '../entities/audit-log.entity'
import { AuditAction } from '../enums/audit-action.enum'
import type { Request } from 'express'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { GetAuditLogsDto } from '../dto/get-audit-logs.dto'
import { FindAllAuditLogsProvider } from './find-all-audit-logs.provider'

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(
    /** inject AuditLog repository for persisting audit records */
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    /** inject find-all provider for the paginated listing */
    private readonly findAllAuditLogsProvider: FindAllAuditLogsProvider,
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
   * name and/or action string (exact match) and sorted by sortBy/order.
   * Each row includes a `user` snapshot of its actor.
   */
  public findAll(
    dto: GetAuditLogsDto,
    request: Request,
  ): Promise<Paginated<AuditLog>> {
    return this.findAllAuditLogsProvider.findAll(dto, request)
  }
}
