import { IsOptional, IsPositive } from 'class-validator'

export class PaginationQueryDto {
  // limit
  @IsOptional()
  @IsPositive()
  limit: number = 10
  // page
  @IsOptional()
  @IsPositive()
  page: number = 1
}
