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
  @IsString()
  @IsNotEmpty()
  key!: string

  @IsString()
  @IsNotEmpty()
  label!: string

  /** Determines what input the filter UI renders: range for 'number', dropdown for 'enum', text for 'string'. */
  @IsIn(['number', 'enum', 'string'])
  type!: 'number' | 'enum' | 'string'

  @IsOptional()
  @IsString()
  unit?: string

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
