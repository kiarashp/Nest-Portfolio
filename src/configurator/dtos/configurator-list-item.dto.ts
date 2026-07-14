import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// The curated public view of a ConfigurableProduct on GET /configurators (the
// browse/list endpoint) — deliberately omits id, imagePublicId, isPublished,
// and timestamps, so internal/admin fields never leak onto the public
// endpoint. Same curation discipline as ConfiguratorFormProductDto, but keeps
// slug since the list is how a customer discovers a slug in the first place.
export class ConfiguratorListItemDto {
  // slug — public URL slug, used to fetch the full form schema next
  @ApiProperty({ example: 'resistive-sensor-with-cap' })
  slug!: string

  // name — customer-facing product family name
  @ApiProperty({ example: 'Resistive sensor with cap' })
  name!: string

  // description — public page copy, null when the admin has not written any
  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null

  // imageUrl — Cloudinary secure URL for the product image, null when unset
  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl?: string | null
}
