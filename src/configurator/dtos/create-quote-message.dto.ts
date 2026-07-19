import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

// Body for posting a message into a quote-request thread — used by both the
// owner route and the admin route.
export class CreateQuoteMessageDto {
  @ApiProperty({
    description: 'The message text, plain text, up to 5000 characters',
    example: 'Could you quote 50 units of this configuration?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string
}
