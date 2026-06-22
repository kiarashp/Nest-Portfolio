import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'
import { AVATAR_OPTIONS } from '../constants/avatar-options'

export class SelectAvatarDto {
  @ApiProperty({
    description: 'Key of the chosen avatar from the available options',
    example: 'avatar-1',
    enum: AVATAR_OPTIONS.map((o) => o.key),
  })
  @IsIn(AVATAR_OPTIONS.map((o) => o.key))
  avatarKey!: string
}
