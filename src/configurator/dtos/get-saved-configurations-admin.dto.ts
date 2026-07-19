import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { QuoteStatus } from '../enums/quote-status.enum'

class GetSavedConfigurationsAdminBaseDto {
  // quoteStatus — exact-match filter; enum params arrive as plain strings,
  // so no boolean-coercion guard is needed here (unlike the old
  // quoteReviewed filter this replaces)
  @ApiPropertyOptional({
    enum: QuoteStatus,
    description: 'Filter by the quote request status',
    example: QuoteStatus.PENDING,
  })
  @IsEnum(QuoteStatus)
  @IsOptional()
  quoteStatus?: QuoteStatus

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
// NOT NULL) at the provider level — this DTO only adds filters on top of that
// base scope.
export class GetSavedConfigurationsAdminDto extends IntersectionType(
  GetSavedConfigurationsAdminBaseDto,
  PaginationQueryDto,
) {}
