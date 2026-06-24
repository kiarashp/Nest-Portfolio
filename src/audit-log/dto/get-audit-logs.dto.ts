import { IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

export class GetAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  entity?: string

  @IsOptional()
  @IsString()
  action?: string
}
