import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// imageUrl/imagePublicId are deliberately absent — they are managed only via
// POST/DELETE /configurator-products/:id/image, never accepted directly, so a
// client can never hand-supply a Cloudinary publicId that a later delete call
// would pass to StorageProvider.delete(). separator is also absent per
// CONFIGURATOR.md §2.1 ("not exposed in admin DTOs for now").
export class CreateConfigurableProductDto {
  @ApiProperty({ example: 'Resistive sensor with cap' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  name!: string

  @ApiProperty({ example: 'resistive-sensor-with-cap' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  slug!: string

  @ApiProperty({ example: 'FRH' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  codePrefix!: string

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean
}
