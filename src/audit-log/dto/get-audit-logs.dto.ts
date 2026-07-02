import { IsIn, IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { AuditAction } from '../enums/audit-action.enum'

/** Columns GET /audit-logs can sort by. */
export const AUDIT_LOG_SORT_FIELDS = [
  'id',
  'action',
  'entity',
  'entityId',
  'userId',
  'createdAt',
] as const
export type AuditLogSortField = (typeof AUDIT_LOG_SORT_FIELDS)[number]

/** Sort directions accepted alongside sortBy. */
export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export class GetAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filter by entity type — exact match',
    example: 'Post',
  })
  @IsOptional()
  @IsString()
  entity?: string

  @ApiPropertyOptional({
    enum: AuditAction,
    description: 'Filter by action — exact match',
  })
  @IsOptional()
  @IsString()
  action?: string

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: AUDIT_LOG_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(AUDIT_LOG_SORT_FIELDS)
  sortBy?: AuditLogSortField

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SORT_ORDERS,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder
}
