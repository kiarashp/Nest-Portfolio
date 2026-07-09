import { PartialType } from '@nestjs/swagger'
import { CreateSegmentDefinitionDto } from './create-segment-definition.dto'

export class UpdateSegmentDefinitionDto extends PartialType(
  CreateSegmentDefinitionDto,
) {}
