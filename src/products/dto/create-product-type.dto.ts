import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** DTO for one entry in the filterableFields array. */
export class FilterableFieldDto {
  @ApiProperty({
    example: 'tempRange',
    description: 'Key matching a product spec',
  })
  @IsString()
  @IsNotEmpty()
  key!: string

  @ApiProperty({
    example: 'Temperature Range',
    description: 'Label shown in the filter UI',
  })
  @IsString()
  @IsNotEmpty()
  label!: string

  /** Determines what input the filter UI renders: range for 'number', dropdown for 'enum', text for 'string'. */
  @ApiProperty({
    enum: ['number', 'enum', 'string'],
    description:
      'Renders a range for number, dropdown for enum, text for string',
  })
  @IsIn(['number', 'enum', 'string'])
  type!: 'number' | 'enum' | 'string'

  @ApiPropertyOptional({
    example: '°C',
    description: 'Unit suffix for display',
  })
  @IsOptional()
  @IsString()
  unit?: string

  @ApiPropertyOptional({
    type: [String],
    example: ['Inconel 600', 'Stainless 316'],
    description: 'Allowed values when type is enum',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]
}

export class CreateProductTypeDto {
  @ApiProperty({
    example: 'Thermocouple',
    description: 'Human-readable product type name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  name!: string

  @ApiProperty({
    example: 'thermocouple',
    description: 'URL-safe slug, unique across types',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  slug!: string

  @ApiPropertyOptional({
    description: 'Filter facets shown in the product filter UI for this type',
    example: [
      {
        key: 'tempRange',
        label: 'Temperature Range',
        type: 'number',
        unit: '°C',
      },
      {
        key: 'sheathMaterial',
        label: 'Sheath Material',
        type: 'enum',
        options: ['Inconel 600', 'Stainless 316'],
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterableFieldDto)
  filterableFields?: FilterableFieldDto[] | null
}
