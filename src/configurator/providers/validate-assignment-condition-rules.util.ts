import { BadRequestException } from '@nestjs/common'
import {
  AssignmentCondition,
  ProductSegmentAssignment,
} from '../entities/product-segment-assignment.entity'
import {
  NumberConstraints,
  SegmentDefinition,
} from '../entities/segment-definition.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

// Which condition operators a controller's dataType may be compared with.
// STRING definitions can never be a condition controller.
const ALLOWED_OPERATORS: Record<SegmentDataType, readonly string[]> = {
  [SegmentDataType.SELECT]: ['eq', 'neq'],
  [SegmentDataType.NUMBER]: ['eq', 'neq', 'gt', 'lt', 'between'],
  [SegmentDataType.STRING]: [],
}

export interface ValidateAssignmentConditionRulesParams {
  condition: AssignmentCondition
  ownDefinition: SegmentDefinition
  // the position this assignment will have once the pending create/move is
  // applied — callers must resolve this before calling, including projecting
  // sibling positions through any pending shift (see shiftedPosition)
  ownFinalPosition: number
  // every other assignment in the same product, each with its definition
  // loaded, with positions already projected through the pending shift
  siblings: ProductSegmentAssignment[]
}

/**
 * Validates a ProductSegmentAssignment's condition against the DB-dependent
 * business rules from CONFIGURATOR.md §4.2/§4.4: the controller must exist in
 * the same product at a strictly lower position, the controller's dataType
 * must allow the chosen operator, and — if this assignment's own definition is
 * NUMBER — its constraints.min must be >= 1 so a forced zero-fill can never
 * collide with a legitimate value. Separate from validateAssignmentCondition
 * (which only checks the condition object's own shape) because these checks
 * need sibling assignment/definition data that only a provider has loaded.
 * Throws BadRequestException on any violation.
 */
export function validateAssignmentConditionRules(
  params: ValidateAssignmentConditionRulesParams,
): void {
  const { condition, ownDefinition, ownFinalPosition, siblings } = params

  const controller = siblings.find(
    (sibling) => sibling.id === condition.controllingAssignmentId,
  )
  if (!controller) {
    throw new BadRequestException(
      `condition.controllingAssignmentId ${condition.controllingAssignmentId} does not reference an assignment in this product`,
    )
  }

  if (controller.position >= ownFinalPosition) {
    throw new BadRequestException(
      'condition.controllingAssignmentId must reference an assignment at a strictly lower position',
    )
  }

  const allowedOperators = ALLOWED_OPERATORS[controller.definition.dataType]
  if (!allowedOperators.includes(condition.operator)) {
    throw new BadRequestException(
      controller.definition.dataType === SegmentDataType.STRING
        ? 'STRING definitions can never be a condition controller'
        : `Operator "${condition.operator}" is not allowed for a ${controller.definition.dataType} controller`,
    )
  }

  if (ownDefinition.dataType === SegmentDataType.NUMBER) {
    const constraints = ownDefinition.constraints as
      | NumberConstraints
      | undefined
      | null
    if (!constraints || constraints.min < 1) {
      throw new BadRequestException(
        'A NUMBER definition used as the target of a condition must have constraints.min >= 1',
      )
    }
  }
}
