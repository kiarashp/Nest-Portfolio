import {
  NumberConstraints,
  SegmentDefinition,
  StringConstraints,
} from '../entities/segment-definition.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

// Outcome of validating one customer-supplied value: either the normalized
// value that goes into the composed code (NUMBER values come back zero-padded
// to full width), or a user-displayable error message.
export type SegmentValueResult =
  | { ok: true; value: string }
  | { ok: false; message: string }

/**
 * Validates a raw customer-supplied value against a segment definition's
 * dataType and constraints (CONFIGURATOR.md §4.3 step 2c) and returns the
 * normalized value on success:
 *
 * - STRING: the reserved value '0' is always rejected (§4.1), the length must
 *   fall within minLength..maxLength, and the optional `pattern` regex must
 *   match. The value is used as-is.
 * - NUMBER: the value must be all digits ('50' and '0050' are both accepted),
 *   is parsed and re-padded to exactly `digits` characters, and must fall
 *   within min..max numerically. The padded form is the normalized value.
 * - SELECT: the value must exactly match one of the definition's option
 *   values (case-sensitive).
 *
 * Error messages include the definition's customer-facing label so the
 * frontend can show them directly.
 */
export function validateSegmentValue(
  definition: Pick<
    SegmentDefinition,
    'label' | 'dataType' | 'constraints' | 'options'
  >,
  raw: string,
): SegmentValueResult {
  if (definition.dataType === SegmentDataType.STRING) {
    return validateStringValue(
      definition.label,
      definition.constraints as StringConstraints,
      raw,
    )
  }
  if (definition.dataType === SegmentDataType.NUMBER) {
    return validateNumberValue(
      definition.label,
      definition.constraints as NumberConstraints,
      raw,
    )
  }
  return validateSelectValue(definition, raw)
}

// STRING: reserved '0', length bounds, optional pattern.
function validateStringValue(
  label: string,
  constraints: StringConstraints,
  raw: string,
): SegmentValueResult {
  if (raw === '0') {
    return {
      ok: false,
      message: `"0" is a reserved value and cannot be used for "${label}"`,
    }
  }
  if (raw.length < constraints.minLength) {
    return {
      ok: false,
      message: `"${label}" must be at least ${constraints.minLength} characters`,
    }
  }
  if (raw.length > constraints.maxLength) {
    return {
      ok: false,
      message: `"${label}" must be at most ${constraints.maxLength} characters`,
    }
  }
  if (
    constraints.pattern !== undefined &&
    !new RegExp(constraints.pattern).test(raw)
  ) {
    return {
      ok: false,
      message: `"${label}" does not match the required format`,
    }
  }
  return { ok: true, value: raw }
}

// NUMBER: digits only, fits in `digits` width after padding, min/max checked
// numerically after parsing.
function validateNumberValue(
  label: string,
  constraints: NumberConstraints,
  raw: string,
): SegmentValueResult {
  if (!/^\d+$/.test(raw)) {
    return { ok: false, message: `"${label}" must be a whole number` }
  }
  const parsed = parseInt(raw, 10)
  const normalized = String(parsed).padStart(constraints.digits, '0')
  if (normalized.length > constraints.digits) {
    return {
      ok: false,
      message: `"${label}" does not fit in ${constraints.digits} digits`,
    }
  }
  if (parsed < constraints.min) {
    return {
      ok: false,
      message: `"${label}" must be at least ${constraints.min}`,
    }
  }
  if (parsed > constraints.max) {
    return {
      ok: false,
      message: `"${label}" must be at most ${constraints.max}`,
    }
  }
  return { ok: true, value: normalized }
}

// SELECT: exact, case-sensitive match against the definition's option values.
function validateSelectValue(
  definition: Pick<SegmentDefinition, 'label' | 'options'>,
  raw: string,
): SegmentValueResult {
  const matches = definition.options?.some((option) => option.value === raw)
  if (!matches) {
    return {
      ok: false,
      message: `"${raw}" is not a valid option for "${definition.label}"`,
    }
  }
  return { ok: true, value: raw }
}
