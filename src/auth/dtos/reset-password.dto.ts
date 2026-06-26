import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from the email link' })
  @IsString()
  @IsNotEmpty()
  token!: string

  @ApiProperty({ minLength: 8, maxLength: 96 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(96)
  newPassword!: string
}
