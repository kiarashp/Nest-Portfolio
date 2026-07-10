import {
  NumberConstraints,
  SegmentDefinition,
} from '../entities/segment-definition.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

/**
 * Returns the zero-fill string for an inactive segment (CONFIGURATOR.md §4.1):
 * STRING and SELECT segments render as a single '0'; NUMBER segments render as
 * '0' repeated to the definition's full `digits` width (e.g. '00', '000',
 * '0000') so the composed code keeps every position at its fixed width.
 */
export function renderZeroFill(
  definition: Pick<SegmentDefinition, 'dataType' | 'constraints'>,
): string {
  if (definition.dataType === SegmentDataType.NUMBER) {
    const constraints = definition.constraints as NumberConstraints
    return '0'.repeat(constraints.digits)
  }
  return '0'
}
