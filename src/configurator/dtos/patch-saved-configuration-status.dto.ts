import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { QuoteStatus } from '../enums/quote-status.enum'

// Body for the admin inbox PATCH — sets the quote request's status to any
// value directly (unlike the automatic PENDING/ANSWERED bumps message posts
// perform).
export class PatchSavedConfigurationStatusDto {
  @ApiProperty({ enum: QuoteStatus, example: QuoteStatus.CLOSED })
  @IsEnum(QuoteStatus)
  quoteStatus!: QuoteStatus
}
