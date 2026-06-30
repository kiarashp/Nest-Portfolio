import { IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { AuditAction } from '../enums/audit-action.enum'

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
}
