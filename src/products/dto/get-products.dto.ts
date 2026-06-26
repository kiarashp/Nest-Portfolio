import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

export class GetProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product type ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  productTypeId?: number

  @ApiPropertyOptional({
    description: 'Keyword search across product name and short description',
    example: 'thermocouple',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string
}
