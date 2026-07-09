import { PartialType } from '@nestjs/swagger'
import { CreateConfigurableProductDto } from './create-configurable-product.dto'

export class UpdateConfigurableProductDto extends PartialType(
  CreateConfigurableProductDto,
) {}
