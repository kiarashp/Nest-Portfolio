import { Injectable } from '@nestjs/common'
import { Request } from 'express'
import { CreateConfigurableProductProvider } from './create-configurable-product.provider'
import { FindAllConfigurableProductsProvider } from './find-all-configurable-products.provider'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { UpdateConfigurableProductProvider } from './update-configurable-product.provider'
import { DeleteConfigurableProductProvider } from './delete-configurable-product.provider'
import { UploadConfigurableProductImageProvider } from './upload-configurable-product-image.provider'
import { DeleteConfigurableProductImageProvider } from './delete-configurable-product-image.provider'
import { CreateConfigurableProductDto } from '../dtos/create-configurable-product.dto'
import { UpdateConfigurableProductDto } from '../dtos/update-configurable-product.dto'
import { GetConfiguratorProductsDto } from '../dtos/get-configurator-products.dto'

/**
 * Thin facade over the ConfigurableProduct CRUD and image providers, one
 * method per route. Mirrors ConfiguratorDefinitionsService/ProductTypesService.
 */
@Injectable()
export class ConfiguratorProductsService {
  constructor(
    private readonly createConfigurableProductProvider: CreateConfigurableProductProvider,
    private readonly findAllConfigurableProductsProvider: FindAllConfigurableProductsProvider,
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    private readonly updateConfigurableProductProvider: UpdateConfigurableProductProvider,
    private readonly deleteConfigurableProductProvider: DeleteConfigurableProductProvider,
    private readonly uploadConfigurableProductImageProvider: UploadConfigurableProductImageProvider,
    private readonly deleteConfigurableProductImageProvider: DeleteConfigurableProductImageProvider,
  ) {}

  public create(dto: CreateConfigurableProductDto, activeUserId: number) {
    return this.createConfigurableProductProvider.create(dto, activeUserId)
  }

  public findAll(dto: GetConfiguratorProductsDto, request: Request) {
    return this.findAllConfigurableProductsProvider.findAll(dto, request)
  }

  public findOne(id: number) {
    return this.findOneConfigurableProductProvider.findOneByIdOrFail(id)
  }

  public update(
    id: number,
    dto: UpdateConfigurableProductDto,
    activeUserId: number,
  ) {
    return this.updateConfigurableProductProvider.update(id, dto, activeUserId)
  }

  public delete(id: number, activeUserId: number) {
    return this.deleteConfigurableProductProvider.delete(id, activeUserId)
  }

  public uploadImage(
    file: Express.Multer.File,
    productId: number,
    activeUserId: number,
  ) {
    return this.uploadConfigurableProductImageProvider.upload(
      file,
      productId,
      activeUserId,
    )
  }

  public deleteImage(productId: number, activeUserId: number) {
    return this.deleteConfigurableProductImageProvider.deleteImage(
      productId,
      activeUserId,
    )
  }
}
