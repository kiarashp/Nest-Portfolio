import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateProductDto {
  @ApiProperty({
    example: 'Type K Thermocouple',
    description: 'Product display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  name!: string

  @ApiProperty({
    example: 'type-k-thermocouple',
    description: 'URL slug, unique across all products',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  slug!: string

  @ApiProperty({
    description: 'ID of the product type this product belongs to',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  productTypeId!: number

  @ApiProperty({
    description: 'Short description for list cards and search results',
    example: 'High-accuracy thermocouple for industrial use',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  shortDescription!: string

  @ApiPropertyOptional({
    description: 'Full detail body shown on the product page',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null

  @ApiPropertyOptional({
    description: 'Vendor or internal SKU code',
    example: 'TC-K-1260-IC',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sku?: string | null

  @ApiPropertyOptional({
    description: 'Main Cloudinary image URL. Send null to clear it.',
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/products/tc-k.jpg',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(1024)
  imageUrl?: string | null

  @ApiPropertyOptional({
    description: 'Gallery of additional Cloudinary URLs',
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[] | null

  @ApiPropertyOptional({
    description:
      "Type-specific attribute values — keys must match the product type's filterableFields",
    example: { tempRange: 1260, accuracy: 0.75, sheathMaterial: 'Inconel 600' },
  })
  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: 'Publish the product immediately (defaults to false)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean

  @ApiPropertyOptional({
    description:
      'Surface the product in a featured section (defaults to false)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean
}
