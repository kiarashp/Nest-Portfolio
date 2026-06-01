import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsJSON,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateTagDto {
  // name
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(256)
  name!: string
  // slug
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(256)
  slug!: string
  // description
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string
  // schema
  @ApiPropertyOptional()
  @IsOptional()
  @IsJSON()
  schema!: string
  // featured image
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(1024)
  featuredImage?: string
}
