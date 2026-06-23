import { IntersectionType } from '@nestjs/swagger'
import { IsDate, IsEnum, IsOptional } from 'class-validator'
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
}

export class GetPostsDto extends IntersectionType(
  GetPostsBaseDto,
  PaginationQueryDto,
) {}
