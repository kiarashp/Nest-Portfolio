import { PartialType } from '@nestjs/swagger'
import { CreatePostMetaOptionsDto } from './create-post-meta-options.dto'

export class UpdateMetaOptionDto extends PartialType(
  CreatePostMetaOptionsDto,
) {}
