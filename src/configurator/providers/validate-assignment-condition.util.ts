import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AssignmentCondition } from '../entities/product-segment-assignment.entity'
import {
  BetweenConditionDto,
  ComparisonConditionDto,
} from '../dtos/assignment-condition.dto'

/**
 * Validates a ProductSegmentAssignment's raw jsonb `condition` against the shape
 * required by its `operator` (CONFIGURATOR.md §3.2). The valid shape depends on
 * the sibling operator field, so this dispatch happens here in the provider
 * layer rather than through class-validator's automatic DTO-tree validation —
 * mirrors validateSegmentConstraints's per-type dispatch for
 * SegmentDefinition.constraints. Only checks the shape of the condition object
 * itself (unknown keys, missing/wrong-typed fields, min < max for `between`);
 * it does not check anything requiring other assignments' data — that is
 * validateAssignmentConditionRules's job. Throws BadRequestException on a
 * malformed condition; otherwise returns the validated, typed condition.
 */
export function validateAssignmentCondition(
  condition: unknown,
): AssignmentCondition {
  if (
    condition === null ||
    typeof condition !== 'object' ||
    typeof (condition as { operator?: unknown }).operator !== 'string'
  ) {
    throw new BadRequestException(
      'condition must be an object with a string "operator" field',
    )
  }

  const operator = (condition as { operator: string }).operator
  const isBetween = operator === 'between'
  const instance = isBetween
    ? plainToInstance(BetweenConditionDto, condition)
    : plainToInstance(ComparisonConditionDto, condition)
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  })

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    )
    throw new BadRequestException(
      `Invalid condition for operator "${operator}": ${messages.join('; ')}`,
    )
  }

  if (isBetween) {
    const between = instance as BetweenConditionDto
    if (between.min >= between.max) {
      throw new BadRequestException(
        'condition.min must be strictly less than condition.max',
      )
    }
  }

  return instance
}
