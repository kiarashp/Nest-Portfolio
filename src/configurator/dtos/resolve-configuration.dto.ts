import { ApiProperty } from '@nestjs/swagger'
import { IsDefined, IsObject } from 'class-validator'

// Request body for POST /configurators/:slug/resolve. `selections` maps
// assignment ids (JSON object keys are always strings) to the raw values the
// customer entered.
export class ResolveConfigurationDto {
  // selections — kept as a raw object map here (no @ValidateNested):
  // class-validator cannot express an integer-keyed free-form map, so deep
  // validation (integer keys, string values) happens in the provider layer
  // via parseSelections — the same pattern as CreateAssignmentDto.condition.
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { '11': '2d', '12': 'yes', '15': '450' },
    description:
      'Map of assignment id (as a JSON object key) to the raw string value the customer entered',
  })
  @IsDefined()
  @IsObject()
  selections!: Record<string, string>
}
