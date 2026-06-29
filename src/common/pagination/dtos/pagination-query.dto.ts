import { IsOptional, IsPositive } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PaginationQueryDto {
  // limit — how many items per page
  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @IsPositive()
  limit: number = 10
  // page — which page to return (1-based)
  @ApiPropertyOptional({
    description: 'Page number to return (1-based)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsPositive()
  page: number = 1
}
