import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

/** Sort orders accepted by GET /products. */
export const PRODUCT_SORTS = ['newest', 'oldest', 'name'] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

export class GetProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product type ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  productTypeId?: number

  @ApiPropertyOptional({
    description:
      'Filter by product type slug — alternative to productTypeId so a per-type page can load without first resolving the id. productTypeId wins if both are sent.',
    example: 'thermocouple',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  typeSlug?: string

  @ApiPropertyOptional({
    description: 'Keyword search across product name and short description',
    example: 'thermocouple',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string

  @ApiPropertyOptional({
    description:
      'Sort order. newest (default) and oldest sort by creation date; name sorts A–Z.',
    enum: PRODUCT_SORTS,
    default: 'newest',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort

  @ApiPropertyOptional({
    description:
      "Spec filters sent as bracket-nested params (parsed by the 'extended' query parser). Enum/string facets take an exact value; number facets take an exact value or a [min]/[max] range. Keys must match the type's filterableFields, so a type context (productTypeId or typeSlug) is required. Example: specs[sheathMaterial]=Inconel 600&specs[tempRange][min]=1000&specs[tempRange][max]=1600.",
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>
}
