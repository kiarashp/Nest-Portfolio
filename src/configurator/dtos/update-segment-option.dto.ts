import { PartialType } from '@nestjs/swagger'
import { CreateSegmentOptionDto } from './create-segment-option.dto'

export class UpdateSegmentOptionDto extends PartialType(
  CreateSegmentOptionDto,
) {}
