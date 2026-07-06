import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { PostStatus } from '../enums/postStatus.enum'

/** Columns GET /posts, /posts/my, and /posts/admin can sort by. */
export const POST_SORT_FIELDS = ['createdAt', 'title'] as const
export type PostSortField = (typeof POST_SORT_FIELDS)[number]

/** Sort directions accepted alongside sortBy. */
export const POST_SORT_ORDERS = ['asc', 'desc'] as const
export type PostSortOrder = (typeof POST_SORT_ORDERS)[number]

class GetPostsBaseDto {
  // start date — query param arrives as a string, transform converts it to a Date before validation
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'ISO 8601 — filter posts created on or after this date',
    example: '2024-01-01',
  })
  @Transform(({ value }: { value: unknown }) => new Date(value as string))
  @IsDate()
  @IsOptional()
  startDate?: Date
  // end date
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'ISO 8601 — filter posts created on or before this date',
    example: '2024-12-31',
  })
  @Transform(({ value }: { value: unknown }) => new Date(value as string))
  @IsDate()
  @IsOptional()
  endDate?: Date
  // filter by post status — used by GET /posts/my and /posts/admin
  @ApiPropertyOptional({
    enum: PostStatus,
    description: 'Filter by post status — used by /posts/my and /posts/admin',
  })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus
  // filter by one or more tag IDs — OR logic, ?tagIds=1&tagIds=2 matches either tag
  @ApiPropertyOptional({
    type: [Number],
    description:
      'Filter by tag IDs — OR logic, returns posts matching any listed tag',
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    // query strings arrive as strings or string arrays — normalise to number[]
    const arr = Array.isArray(value)
      ? value
      : value !== undefined
        ? [value]
        : undefined
    return arr?.map(Number)
  })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  tagIds?: number[]
  // filter by author user ID
  @ApiPropertyOptional({
    type: Number,
    description: 'Filter by author user ID',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  authorId?: number
  // filter by featured flag — works on all three routes (GET /posts, /posts/my,
  // /posts/admin). Query param arrives as the string 'true'/'false'; @Type(String)
  // stops the global ValidationPipe's enableImplicitConversion from coercing it
  // to true first (see root CLAUDE.md's boolean query-param gotcha).
  @ApiPropertyOptional({
    description: 'Filter by featured flag — works on all three routes',
    example: true,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean
  // keyword search across post title and content — case-insensitive partial match
  @ApiPropertyOptional({
    description: 'Keyword search across title and content',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string
  // column to sort by — defaults to createdAt in the provider
  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: POST_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(POST_SORT_FIELDS)
  sortBy?: PostSortField
  // sort direction — defaults to desc in the provider
  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: POST_SORT_ORDERS,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(POST_SORT_ORDERS)
  order?: PostSortOrder
}

export class GetPostsDto extends IntersectionType(
  GetPostsBaseDto,
  PaginationQueryDto,
) {}
