import { IsInt, IsOptional, IsString, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Constraints shape for a SegmentDefinition with dataType STRING. Validated
 * programmatically (via validateSegmentConstraints) against the raw jsonb the
 * client sends, since the required shape depends on the sibling dataType field.
 */
export class StringConstraintsDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  minLength!: number

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  maxLength!: number

  @ApiPropertyOptional({ example: '^[a-z]+$' })
  @IsOptional()
  @IsString()
  pattern?: string
}

/**
 * Constraints shape for a SegmentDefinition with dataType NUMBER. Values are
 * rendered as a zero-padded string of exactly `digits` characters.
 */
export class NumberConstraintsDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  digits!: number

  @ApiProperty({ example: 50 })
  @IsInt()
  min!: number

  @ApiProperty({ example: 2000 })
  @IsInt()
  max!: number
}
