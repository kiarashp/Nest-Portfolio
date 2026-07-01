import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class SetEmailVerifiedDto {
  // Whether the user's email should be marked as verified
  @ApiProperty({ example: true })
  @IsBoolean()
  isEmailVerified!: boolean
}
