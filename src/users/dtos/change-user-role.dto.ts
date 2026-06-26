import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { UserRole } from 'src/auth/enums/user-role.enum'

export class ChangeUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole
}
