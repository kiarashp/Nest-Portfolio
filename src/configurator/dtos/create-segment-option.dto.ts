import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateSegmentOptionDto {
  @ApiProperty({
    example: '2d',
    description:
      'What goes into the composed code. Must not be "0" (reserved).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  value!: string

  @ApiProperty({ example: 'double Pt500' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  label!: string

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order in the dropdown',
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number
}
