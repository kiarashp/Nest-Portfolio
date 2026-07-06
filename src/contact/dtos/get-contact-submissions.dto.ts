import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDate, IsOptional } from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

class GetContactSubmissionsBaseDto {
  // handled — query param arrives as the string 'true'/'false'. @Type(String) stops the
  // global ValidationPipe's enableImplicitConversion from coercing it to a boolean via
  // Boolean(value) first (which would make 'false' truthy); the explicit @Transform then
  // converts the raw string to a real boolean before validation.
  @ApiPropertyOptional({
    description: 'Filter by whether the submission has been reviewed',
    example: false,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  handled?: boolean
  // start date — query param arrives as a string, transform converts it to a Date before validation
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'ISO 8601 — filter submissions received on or after this date',
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
    description:
      'ISO 8601 — filter submissions received on or before this date',
    example: '2024-12-31',
  })
  @Transform(({ value }: { value: unknown }) => new Date(value as string))
  @IsDate()
  @IsOptional()
  endDate?: Date
}

export class GetContactSubmissionsDto extends IntersectionType(
  GetContactSubmissionsBaseDto,
  PaginationQueryDto,
) {}
