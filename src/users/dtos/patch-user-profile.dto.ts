import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class PatchUserProfileDto {
  @ApiPropertyOptional({ description: 'User first name', example: 'Ichigo' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(96)
  firstName?: string

  @ApiPropertyOptional({ description: 'User last name', example: 'Kurosaki' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(96)
  lastName?: string
}
