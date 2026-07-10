import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import {
  ConfiguratorFormSchemaDto,
  ConfiguratorFormSegmentDto,
} from '../dtos/configurator-form-schema.dto'

/**
 * Maps a fully-loaded ConfigurableProduct (assignments → definition →
 * options, already ordered by position/sortOrder by the provider) to the
 * curated public form schema of GET /configurators/:slug (CONFIGURATOR.md
 * §5.2). The product header exposes only name, description, imageUrl,
 * codePrefix, and separator — id, slug, imagePublicId, isPublished, and
 * timestamps are deliberately omitted. Each segment flattens the assignment
 * and its definition into one object keyed by assignmentId (the key the
 * resolve endpoint expects in `selections`); `options` is present only for
 * SELECT segments, and the condition is passed through as stored so the
 * frontend can live-disable inputs while the backend resolve stays the
 * source of truth.
 */
export function buildFormSchema(
  product: ConfigurableProduct,
): ConfiguratorFormSchemaDto {
  const segments: ConfiguratorFormSegmentDto[] = (
    product.assignments ?? []
  ).map((assignment) => ({
    assignmentId: assignment.id,
    position: assignment.position,
    label: assignment.definition.label,
    dataType: assignment.definition.dataType,
    constraints: assignment.definition.constraints ?? null,
    options:
      assignment.definition.dataType === SegmentDataType.SELECT
        ? (assignment.definition.options ?? []).map((option) => ({
            value: option.value,
            label: option.label,
          }))
        : undefined,
    condition: assignment.condition ?? null,
  }))

  return {
    product: {
      name: product.name,
      description: product.description ?? null,
      imageUrl: product.imageUrl ?? null,
      codePrefix: product.codePrefix,
      separator: product.separator,
    },
    segments,
  }
}
