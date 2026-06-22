import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CreateContactDto {
  // sender name — trimmed before validation so whitespace-only strings fail @IsNotEmpty
  @ApiProperty({ example: 'Jane Doe' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string
  // sender email
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string
  // message subject — trimmed before validation so whitespace-only strings fail @IsNotEmpty
  @ApiProperty({ example: 'Hiring inquiry' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string
  // message body — trimmed before validation so whitespace-only strings fail @IsNotEmpty
  @ApiProperty({ example: 'Hello, I wanted to reach out...' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string
}
