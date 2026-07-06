import { IsInt, IsOptional, IsPositive, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class GetProductBySlugDto {
  @ApiPropertyOptional({
    description:
      'When set, include up to N related products (same type, published, excluding self) inline on the response as `related`',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(20)
  includeRelated?: number
}
