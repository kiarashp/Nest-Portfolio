import { IntersectionType } from '@nestjs/swagger'
import { IsDate, IsOptional } from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

class GetPostsBaseDto {
  // start date
  @IsDate()
  @IsOptional()
  startDate?: Date
  // end date
  @IsDate()
  @IsOptional()
  endDate?: Date
}

export class GetPostsDto extends IntersectionType(
  GetPostsBaseDto,
  PaginationQueryDto,
) {}
