import { IsInt, IsOptional, IsPositive, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class GetRelatedProductsDto {
  @ApiPropertyOptional({
    description: 'Max number of related products to return',
    default: 4,
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(20)
  limit?: number
}
