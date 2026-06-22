import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
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

  @ApiPropertyOptional({
    description: 'Short plain-text bio (max 500 chars)',
    example: 'I build things for the web.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  bio?: string | null
}
