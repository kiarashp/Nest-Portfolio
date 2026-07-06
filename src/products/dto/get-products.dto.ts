import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

/** Sortable columns accepted by GET /products. */
export const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'featured'] as const
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number]

/** Sort directions accepted by GET /products. */
export const PRODUCT_SORT_ORDERS = ['asc', 'desc'] as const
export type ProductSortOrder = (typeof PRODUCT_SORT_ORDERS)[number]

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
      'Column to sort by (default createdAt). featured sorts isFeatured first, then always tiebreaks by createdAt — order controls the direction of both createdAt and the featured tiebreak.',
    enum: PRODUCT_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy?: ProductSortField

  @ApiPropertyOptional({
    description: 'Sort direction (default desc)',
    enum: PRODUCT_SORT_ORDERS,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_ORDERS)
  order?: ProductSortOrder

  // isPublished — admin route only (GET /products/admin); the public route always hardcodes
  // isPublished = true and ignores this field. Query param arrives as the string 'true'/'false'.
  // @Type(String) stops the global ValidationPipe's enableImplicitConversion from coercing it to
  // a boolean via Boolean(value) first (which would make 'false' truthy); the explicit @Transform
  // then converts the raw string to a real boolean before validation.
  @ApiPropertyOptional({
    description:
      'Filter by publish status — admin route only (GET /products/admin); ignored on the public GET /products route',
    example: true,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean

  // isFeatured — available on both the public GET /products and GET /products/admin
  // routes, unlike isPublished which is admin-only and hardcoded on the public route.
  @ApiPropertyOptional({
    description:
      'Filter by featured flag — available on both public and admin routes',
    example: true,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean

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
