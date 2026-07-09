import { IsInt, IsObject, IsOptional, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// condition is kept as a raw object here (no @ValidateNested) — its valid
// shape depends on the sibling `operator` field, so shape validation happens
// in the provider layer (validateAssignmentCondition), mirroring how
// SegmentDefinition.constraints is validated against dataType.
export class CreateAssignmentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  definitionId!: number

  @ApiPropertyOptional({
    example: 3,
    description: '1-based position within the product; defaults to append',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'Zero-fill rule keyed on an earlier assignment — shape depends on operator, see ComparisonConditionDto/BetweenConditionDto',
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown> | null
}
