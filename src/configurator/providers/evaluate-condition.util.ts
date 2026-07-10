import { AssignmentCondition } from '../entities/product-segment-assignment.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

// The resolved state of a controlling segment as seen by the resolver's
// forward pass: whether it ended up active, and the value it resolved to.
// `value` is null when the segment is active but its value is missing or
// invalid — an unusable controller.
export interface ControllerResolvedState {
  active: boolean
  value: string | null
  dataType: SegmentDataType
}

/**
 * Evaluates an assignment's condition against the already-resolved state of
 * its controlling segment and returns true when the condition is MET (the
 * dependent segment is active). Two rules run before any operator comparison
 * (CONFIGURATOR.md §4.2):
 *
 * - Cascade rule: a zero-filled (inactive) controller means "nothing is
 *   there", so every condition watching it evaluates as NOT MET regardless of
 *   operator — including `neq`, even though `0 ≠ x` is technically true.
 * - Errored controller: a controller that is active but has no usable value
 *   (missing or failed validation) also evaluates as NOT MET — the dependent
 *   zero-fills, mirroring the cascade rule. The overall resolve result is
 *   already invalid in that case, so no code is emitted either way; this rule
 *   only keeps the per-segment UI state consistent.
 *
 * SELECT controllers compare as strings (`eq`/`neq` only — enforced at admin
 * time); NUMBER controllers compare numerically, so a padded value like
 * '0450' equals a condition value of '450'.
 */
export function evaluateCondition(
  condition: AssignmentCondition,
  controller: ControllerResolvedState,
): boolean {
  if (!controller.active) {
    return false
  }
  if (controller.value === null) {
    return false
  }

  if (controller.dataType === SegmentDataType.SELECT) {
    if (condition.operator === 'eq') {
      return controller.value === condition.value
    }
    return controller.value !== condition.value
  }

  // NUMBER controller — compare numerically. The controller's resolved value
  // is always a validated digit string, so Number() cannot yield NaN here.
  const resolved = Number(controller.value)
  switch (condition.operator) {
    case 'eq':
      return resolved === Number(condition.value)
    case 'neq':
      return resolved !== Number(condition.value)
    case 'gt':
      return resolved > Number(condition.value)
    case 'lt':
      return resolved < Number(condition.value)
    case 'between':
      return (
        resolved >= (condition.min as number) &&
        resolved <= (condition.max as number)
      )
  }
}
