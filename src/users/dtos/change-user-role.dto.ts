import { IsEnum } from 'class-validator'
import { UserRole } from 'src/auth/enums/user-role.enum'

export class ChangeUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole
}
