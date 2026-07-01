import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional } from 'class-validator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { CreateUserDto } from './create-user.dtos'

export class AdminCreateUserDto extends CreateUserDto {
  // Role to assign to the new user — defaults to USER when omitted
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  // Whether the new user's email should be marked as already verified —
  // defaults to false, which sends the normal verification email
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean
}
