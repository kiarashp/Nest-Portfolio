import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsPositive } from 'class-validator'

export class SelectAvatarDto {
  @ApiProperty({
    description:
      'ID of the chosen avatar option from GET /users/avatar-options',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  avatarOptionId!: number
}
