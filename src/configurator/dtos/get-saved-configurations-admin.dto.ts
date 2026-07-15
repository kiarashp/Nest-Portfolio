import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

class GetSavedConfigurationsAdminBaseDto {
  // quoteReviewed — query param arrives as the string 'true'/'false'. @Type(String) stops the
  // global ValidationPipe's enableImplicitConversion from coercing it to a boolean via
  // Boolean(value) first (which would make 'false' truthy); the explicit @Transform then
  // converts the raw string to a real boolean before validation.
  @ApiPropertyOptional({
    description: 'Filter by whether the quote request has been reviewed',
    example: false,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  quoteReviewed?: boolean

  // startDate — query param arrives as a string, transform converts it to a Date before validation
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'ISO 8601 — filter quote requests made on or after this date',
    example: '2026-07-01',
  })
  @Transform(({ value }: { value: unknown }) => new Date(value as string))
  @IsDate()
  @IsOptional()
  startDate?: Date

  // endDate
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'ISO 8601 — filter quote requests made on or before this date',
    example: '2026-07-31',
  })
  @Transform(({ value }: { value: unknown }) => new Date(value as string))
  @IsDate()
  @IsOptional()
  endDate?: Date

  // email — case-insensitive substring match against the requesting user's email
  @ApiPropertyOptional({
    description:
      "Case-insensitive substring match against the requester's email",
    example: 'ada',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  email?: string
}

// The list is always scoped to rows with a quote request (quoteRequestedAt IS
// NOT NULL) at the provider level — this DTO only adds the reviewed filter on
// top of that base scope.
export class GetSavedConfigurationsAdminDto extends IntersectionType(
  GetSavedConfigurationsAdminBaseDto,
  PaginationQueryDto,
) {}
