import { BadRequestException } from '@nestjs/common'
import { FilterableField } from '../entities/product-type.entity'

/**
 * Finds the filterable field definition for a spec key on a product type.
 * Throws BadRequestException when the key is not declared in filterableFields,
 * which keeps stored specs and filter queries aligned with the type's schema.
 */
export function findFilterableField(
  fields: FilterableField[] | null | undefined,
  key: string,
): FilterableField {
  const field = fields?.find((f) => f.key === key)
  if (!field) {
    throw new BadRequestException(
      `Unknown spec key "${key}" — not declared in this product type's filterableFields`,
    )
  }
  return field
}

/**
 * Finds the field definition for a spec key used in a catalog filter query.
 * Builds on findFilterableField (the key must still be a declared spec), then
 * additionally rejects a key whose field has isFilterable set to false — a
 * valid stored spec that the admin has opted out of the filter UI.
 */
export function findQueryableField(
  fields: FilterableField[] | null | undefined,
  key: string,
): FilterableField {
  const field = findFilterableField(fields, key)
  if (field.isFilterable === false) {
    throw new BadRequestException(`Spec "${key}" is not filterable`)
  }
  return field
}

/**
 * Validates a product's stored specs against its product type's filterableFields.
 * Every spec key must be declared on the type, and each value must match the
 * declared field type (number/string, or one of the enum options). This runs on
 * create and update so the data that powers the filter UI stays well-formed.
 */
export function validateSpecsAgainstType(
  specs: Record<string, unknown> | null | undefined,
  fields: FilterableField[] | null | undefined,
): void {
  if (!specs) return

  for (const [key, value] of Object.entries(specs)) {
    const field = findFilterableField(fields, key)

    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new BadRequestException(`Spec "${key}" must be a number`)
        }
        break
      case 'string':
        if (typeof value !== 'string') {
          throw new BadRequestException(`Spec "${key}" must be a string`)
        }
        break
      case 'enum':
        if (typeof value !== 'string' || !field.options?.includes(value)) {
          throw new BadRequestException(
            `Spec "${key}" must be one of: ${(field.options ?? []).join(', ')}`,
          )
        }
        break
    }
  }
}
