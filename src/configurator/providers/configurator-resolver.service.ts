import { Injectable } from '@nestjs/common'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import {
  ResolveErrorDto,
  ResolveResultDto,
  ResolveSegmentStateDto,
} from '../dtos/resolve-result.dto'
import {
  ControllerResolvedState,
  evaluateCondition,
} from './evaluate-condition.util'
import { parseSelections } from './parse-selections.util'
import { renderZeroFill } from './render-zero-fill.util'
import { validateSegmentValue } from './validate-segment-value.util'
import { renderMeaning } from './render-meaning.util'

// The resolver — the single source of truth for turning a customer's
// selections into an ordering code (CONFIGURATOR.md §4.3). Stateless and
// dependency-free: it receives a fully-loaded product and never touches the
// database, so it can be unit-tested with `new ConfiguratorResolverService()`.
@Injectable()
export class ConfiguratorResolverService {
  /**
   * Resolves a selections map against a product's ordered assignment tree
   * (assignments → definition → options, position ASC — as loaded by
   * FindOneConfigurableProductProvider) and returns the §4.3 result object.
   *
   * The algorithm is a single forward pass in position order. For each
   * assignment: evaluate its condition against the already-resolved state of
   * the controller (which the direction rule guarantees is earlier in the
   * pass); an inactive segment resolves to its zero-fill string and any
   * supplied value for it is silently ignored; an active segment requires a
   * value, validated against its definition. All validation failures are
   * collected — the pass never stops at the first error. `code` and `summary`
   * are present only when every active segment validated; zero-filled
   * segments are omitted from the summary entirely.
   *
   * Two deliberate edge behaviors beyond the spec's wording:
   * - Selection keys that are well-formed integers but match no assignment in
   *   this product are silently ignored (a stale form after an admin edit
   *   should not hard-fail an otherwise-complete resolve).
   * - A dependent whose controller is active but errored (value missing or
   *   invalid) zero-fills, mirroring the cascade rule — "nothing usable is
   *   there". The result is already invalid in that case, so this only keeps
   *   the per-segment UI state consistent.
   *
   * Throws BadRequestException (via parseSelections) when the selections map
   * itself is malformed — non-integer keys or non-string values.
   */
  public resolve(
    product: ConfigurableProduct,
    rawSelections: Record<string, unknown>,
  ): ResolveResultDto {
    const selections = parseSelections(rawSelections)
    const assignments = product.assignments ?? []
    const errors: ResolveErrorDto[] = []
    // Resolved state per assignment id, filled in position order so later
    // conditions can look up their controller's outcome.
    const states = new Map<number, ControllerResolvedState>()

    for (const assignment of assignments) {
      const definition = assignment.definition
      let active = true
      if (assignment.condition) {
        const controller = states.get(
          assignment.condition.controllingAssignmentId,
        )
        // The admin-time direction rule guarantees the controller was already
        // resolved; a missing entry can only mean inconsistent data, so fail
        // safe by zero-filling the dependent.
        active = controller
          ? evaluateCondition(assignment.condition, controller)
          : false
      }

      if (!active) {
        states.set(assignment.id, {
          active: false,
          value: renderZeroFill(definition),
          dataType: definition.dataType,
        })
        continue
      }

      const raw = selections.get(assignment.id)
      if (raw === undefined) {
        errors.push({
          assignmentId: assignment.id,
          message: `A value is required for "${definition.label}"`,
        })
        states.set(assignment.id, {
          active: true,
          value: null,
          dataType: definition.dataType,
        })
        continue
      }

      const result = validateSegmentValue(definition, raw)
      if (result.ok) {
        states.set(assignment.id, {
          active: true,
          value: result.value,
          dataType: definition.dataType,
        })
      } else {
        errors.push({ assignmentId: assignment.id, message: result.message })
        states.set(assignment.id, {
          active: true,
          value: null,
          dataType: definition.dataType,
        })
      }
    }

    // Per-segment resolved state, returned on every call so the frontend can
    // render each input's status; errored segments echo the raw input.
    const segments: ResolveSegmentStateDto[] = assignments.map((assignment) => {
      const state = states.get(assignment.id) as ControllerResolvedState
      return {
        assignmentId: assignment.id,
        position: assignment.position,
        active: state.active,
        value: state.value ?? selections.get(assignment.id) ?? '',
      }
    })

    if (errors.length > 0) {
      return { valid: false, errors, segments }
    }

    // Every state value is non-null here — an active segment with a null
    // value would have produced an error above.
    const values = assignments.map(
      (assignment) => states.get(assignment.id)!.value!,
    )
    const code = [product.codePrefix, ...values].join(product.separator)

    const summary = assignments
      .filter((assignment) => states.get(assignment.id)!.active)
      .map((assignment) => {
        const value = states.get(assignment.id)!.value!
        const label =
          assignment.definition.dataType === SegmentDataType.SELECT
            ? assignment.definition.options?.find(
                (option) => option.value === value,
              )?.label
            : undefined
        return renderMeaning(
          assignment.definition.meaningTemplate,
          value,
          label,
        )
      })

    return { valid: true, errors: [], code, summary, segments }
  }
}
