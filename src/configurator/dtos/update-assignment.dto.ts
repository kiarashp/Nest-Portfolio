import { IsInt, IsObject, IsOptional, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Deliberately not PartialType(CreateAssignmentDto) — definitionId is
// immutable once an assignment exists, so it has no place in this DTO.
export class UpdateAssignmentDto {
  @ApiPropertyOptional({
    example: 2,
    description: '1-based position within the product; reorders siblings',
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
      'Zero-fill rule keyed on an earlier assignment. Send null to clear, omit to leave unchanged.',
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown> | null
}
