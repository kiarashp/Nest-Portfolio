import { IsIn, IsInt, IsNumber, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

// Operators whose shape is a single scalar comparison against `value`.
export const COMPARISON_OPERATORS = ['eq', 'neq', 'gt', 'lt'] as const

/**
 * Condition shape for the eq/neq/gt/lt operators — compares the controlling
 * assignment's resolved value against a single `value`. Validated
 * programmatically (via validateAssignmentCondition) against the raw jsonb the
 * client sends, since the required shape depends on the sibling `operator` field.
 */
export class ComparisonConditionDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  controllingAssignmentId!: number

  @ApiProperty({ enum: COMPARISON_OPERATORS, example: 'eq' })
  @IsIn(COMPARISON_OPERATORS)
  operator!: 'eq' | 'neq' | 'gt' | 'lt'

  @ApiProperty({ example: 'yes' })
  @IsString()
  value!: string

  @ApiProperty({ enum: ['zero_fill'], example: 'zero_fill' })
  @IsIn(['zero_fill'])
  effect!: 'zero_fill'
}

/**
 * Condition shape for the `between` operator — compares the controlling
 * assignment's resolved numeric value against an inclusive [min, max] range.
 */
export class BetweenConditionDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  controllingAssignmentId!: number

  @ApiProperty({ enum: ['between'], example: 'between' })
  @IsIn(['between'])
  operator!: 'between'

  @ApiProperty({ example: 30 })
  @IsNumber()
  min!: number

  @ApiProperty({ example: 99 })
  @IsNumber()
  max!: number

  @ApiProperty({ enum: ['zero_fill'], example: 'zero_fill' })
  @IsIn(['zero_fill'])
  effect!: 'zero_fill'
}
