import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SegmentDataType } from '../enums/segment-data-type.enum'

export class CreateSegmentDefinitionDto {
  @ApiProperty({ example: 'Sensor type (1m/2m/1d/2d)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  name!: string

  @ApiProperty({ example: 'Sensor type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  label!: string

  @ApiProperty({ enum: SegmentDataType, example: SegmentDataType.SELECT })
  @IsEnum(SegmentDataType)
  dataType!: SegmentDataType

  /**
   * Shape depends on dataType — StringConstraintsDto for STRING, NumberConstraintsDto
   * for NUMBER, empty/omitted for SELECT. Validated in the provider layer
   * (validateSegmentConstraints) since class-validator cannot express a shape that
   * depends on a sibling field.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Shape depends on dataType — see StringConstraintsDto/NumberConstraintsDto',
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  constraints?: Record<string, unknown> | null

  @ApiProperty({ example: 'Sensor: {label}' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  meaningTemplate!: string
}
