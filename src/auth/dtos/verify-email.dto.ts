import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token from the verification email link',
  })
  @IsString()
  @IsNotEmpty()
  token!: string
}
