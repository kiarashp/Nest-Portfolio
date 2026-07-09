import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { SegmentConstraints } from '../entities/segment-definition.entity'
import {
  NumberConstraintsDto,
  StringConstraintsDto,
} from '../dtos/segment-constraints.dto'

/**
 * Validates a SegmentDefinition's raw jsonb `constraints` against the shape
 * required by its dataType (§3.1 of CONFIGURATOR.md). The valid shape depends on
 * the sibling dataType field, so this dispatch happens here in the provider layer
 * rather than through class-validator's automatic DTO-tree validation — mirrors
 * classify-type-change.util.ts's per-type dispatch for ProductType.filterableFields.
 * Throws BadRequestException on a missing/wrong-shaped/unknown-key constraints
 * object; otherwise returns the validated, typed constraints.
 */
export function validateSegmentConstraints(
  dataType: SegmentDataType,
  constraints: unknown,
): SegmentConstraints {
  if (dataType === SegmentDataType.SELECT) {
    if (
      constraints !== undefined &&
      constraints !== null &&
      Object.keys(constraints).length > 0
    ) {
      throw new BadRequestException(
        'SELECT definitions do not accept constraints — options live in SegmentOption rows',
      )
    }
    return {}
  }

  if (constraints === undefined || constraints === null) {
    throw new BadRequestException(
      `constraints are required for dataType "${dataType}"`,
    )
  }

  const instance =
    dataType === SegmentDataType.STRING
      ? plainToInstance(StringConstraintsDto, constraints)
      : plainToInstance(NumberConstraintsDto, constraints)
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  })

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    )
    throw new BadRequestException(
      `Invalid constraints for dataType "${dataType}": ${messages.join('; ')}`,
    )
  }

  return instance
}
