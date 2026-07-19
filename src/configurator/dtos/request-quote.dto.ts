import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

// Body for POST /saved-configurations/:id/request-quote. The message is
// optional so existing body-less calls keep working; when present it becomes
// the first message of the quote-request thread and rides inside the
// quote-request notification email (no second email is sent).
export class RequestQuoteDto {
  @ApiPropertyOptional({
    description:
      'Optional first message for the quote-request thread, up to 5000 characters',
    example: 'We need these delivered by the end of the quarter.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message?: string
}
