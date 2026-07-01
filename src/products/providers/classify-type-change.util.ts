import { BadRequestException } from '@nestjs/common'
import { FilterableField } from '../entities/product-type.entity'

/**
 * Describes a filterableFields change that removes something, so the caller must
 * first check whether any product still holds the affected data before allowing
 * it. A 'fieldRemoved' drops an entire field; an 'optionsRemoved' drops one or
 * more choices from an enum field (the removed values are listed).
 */
export interface RemovalCheck {
  key: string
  kind: 'fieldRemoved' | 'optionsRemoved'
  /** Only set when kind is 'optionsRemoved' — the enum options that were dropped. */
  removedOptions?: string[]
}

/**
 * Compares a product type's old filterableFields against the new array proposed in
 * an update and enforces the field-evolution rules. Fields are matched by key.
 *
 * Two attributes are immutable: a field's key and its type. A type change would
 * strand every product's stored value (a number filter can no longer read text),
 * so it is rejected outright here with BadRequestException. A key change is not an
 * in-place edit — it reads as removing the old key and adding a new one — so it is
 * handled by the removal check on the old key rather than throwing here. Label and
 * unit are display-only and may change freely.
 *
 * The function returns the removals that still need a database usage-check before
 * they can be allowed (dropping a field, or dropping enum options). Purely additive
 * or cosmetic changes return an empty array.
 */
export function classifyTypeChange(
  oldFields: FilterableField[] | null | undefined,
  newFields: FilterableField[] | null | undefined,
): RemovalCheck[] {
  const oldList = oldFields ?? []
  const newList = newFields ?? []
  const newByKey = new Map(newList.map((f) => [f.key, f]))

  const checks: RemovalCheck[] = []

  for (const oldField of oldList) {
    const newField = newByKey.get(oldField.key)

    // Field is gone from the new array — it is being removed.
    if (!newField) {
      checks.push({ key: oldField.key, kind: 'fieldRemoved' })
      continue
    }

    // Field is kept — its type may never change (it would break stored values).
    if (newField.type !== oldField.type) {
      throw new BadRequestException(
        `Cannot change the "type" of field "${oldField.key}"; remove it and add a new field instead`,
      )
    }

    // Enum field kept — flag any options that were dropped for a usage-check.
    if (oldField.type === 'enum') {
      const newOptions = newField.options ?? []
      const removedOptions = (oldField.options ?? []).filter(
        (o) => !newOptions.includes(o),
      )
      if (removedOptions.length > 0) {
        checks.push({
          key: oldField.key,
          kind: 'optionsRemoved',
          removedOptions,
        })
      }
    }
  }

  return checks
}
