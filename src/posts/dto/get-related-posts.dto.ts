import { IsInt, IsOptional, IsPositive, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class GetRelatedPostsDto {
  @ApiPropertyOptional({
    description: 'Max number of related posts to return',
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
