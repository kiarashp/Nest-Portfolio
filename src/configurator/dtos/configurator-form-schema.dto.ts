import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { SegmentConstraints } from '../entities/segment-definition.entity'
import { AssignmentCondition } from '../entities/product-segment-assignment.entity'

// The curated public view of a ConfigurableProduct on the form schema
// (CONFIGURATOR.md §5.2) — deliberately omits id, slug, imagePublicId,
// isPublished, and timestamps, so internal/admin fields never leak onto the
// public endpoint. Documentation-and-runtime DTO, same idea as PublicAuthor.
export class ConfiguratorFormProductDto {
  // name — customer-facing product family name
  @ApiProperty({ example: 'Resistive sensor with cap' })
  name!: string

  // description — public page copy, null when the admin has not written any
  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null

  // imageUrl — Cloudinary secure URL for the product image, null when unset
  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl?: string | null

  // codePrefix — the static first token of every composed code
  @ApiProperty({ example: 'FRH' })
  codePrefix!: string

  // separator — the character joining code tokens
  @ApiProperty({ example: '-' })
  separator!: string
}

// One selectable option of a SELECT segment, reduced to the two fields the
// public form needs.
export class ConfiguratorFormOptionDto {
  // value — what goes into the composed code
  @ApiProperty({ example: '2d' })
  value!: string

  // label — the human meaning shown in the dropdown
  @ApiProperty({ example: 'double Pt500' })
  label!: string
}

// One position of the configurator form, flattened from a
// ProductSegmentAssignment and its SegmentDefinition.
export class ConfiguratorFormSegmentDto {
  // assignmentId — the key the resolve endpoint expects in `selections`
  @ApiProperty({ example: 11 })
  assignmentId!: number

  // position — 1-based display/code order
  @ApiProperty({ example: 1 })
  position!: number

  // label — the customer-facing question for this segment
  @ApiProperty({ example: 'Sensor type' })
  label!: string

  // dataType — drives which input the frontend renders
  @ApiProperty({ enum: SegmentDataType, example: SegmentDataType.SELECT })
  dataType!: SegmentDataType

  // constraints — STRING/NUMBER validation bounds, null/empty for SELECT
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Shape depends on dataType — see StringConstraints/NumberConstraints',
    nullable: true,
  })
  constraints?: SegmentConstraints | null

  // options — SELECT segments only; omitted entirely for STRING/NUMBER
  @ApiPropertyOptional({
    type: [ConfiguratorFormOptionDto],
    description: 'Present only for SELECT segments',
  })
  options?: ConfiguratorFormOptionDto[]

  // condition — exposed so the frontend can live-disable inputs; the backend
  // resolve remains the source of truth
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Zero-fill rule keyed on an earlier assignment in the same product',
    nullable: true,
  })
  condition?: AssignmentCondition | null
}

// The full public form schema returned by GET /configurators/:slug.
export class ConfiguratorFormSchemaDto {
  // product — curated product header fields
  @ApiProperty({ type: ConfiguratorFormProductDto })
  product!: ConfiguratorFormProductDto

  // segments — every position of the form, ordered by position
  @ApiProperty({ type: [ConfiguratorFormSegmentDto] })
  segments!: ConfiguratorFormSegmentDto[]
}
