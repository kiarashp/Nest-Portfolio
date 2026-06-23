import { IntersectionType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { PostStatus } from '../enums/postStatus.enum'

class GetPostsBaseDto {
  // start date
  @IsDate()
  @IsOptional()
  startDate?: Date
  // end date
  @IsDate()
  @IsOptional()
  endDate?: Date
  // filter by post status — used by GET /posts/my only
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus
  // filter by one or more tag IDs — OR logic, ?tagIds=1&tagIds=2 matches either tag
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
  @IsOptional()
  @IsInt()
  @IsPositive()
  authorId?: number
}

export class GetPostsDto extends IntersectionType(
  GetPostsBaseDto,
  PaginationQueryDto,
) {}
