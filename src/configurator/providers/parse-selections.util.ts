import { BadRequestException } from '@nestjs/common'

/**
 * Parses the raw `selections` request body map into a Map keyed by integer
 * assignment id. JSON object keys are always strings, so each key must be a
 * plain non-negative integer literal (digits only) and each value must be a
 * string — anything else is a malformed request shape and throws
 * BadRequestException (400) before resolution starts, rather than becoming a
 * per-segment resolve error. Deep validation lives here in the provider layer
 * because class-validator cannot express a free-form integer-keyed map — the
 * same pattern as CreateAssignmentDto.condition.
 */
export function parseSelections(
  raw: Record<string, unknown>,
): Map<number, string> {
  const selections = new Map<number, string>()
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(key)) {
      throw new BadRequestException(
        'selections keys must be integer assignment ids',
      )
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('selections values must be strings')
    }
    selections.set(parseInt(key, 10), value)
  }
  return selections
}
