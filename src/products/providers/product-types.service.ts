import { Injectable } from '@nestjs/common'
import { CreateProductTypeDto } from '../dto/create-product-type.dto'
import { UpdateProductTypeDto } from '../dto/update-product-type.dto'
import { ProductType } from '../entities/product-type.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindAllProductTypesProvider } from './find-all-product-types.provider'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { CreateProductTypeProvider } from './create-product-type.provider'
import { UpdateProductTypeProvider } from './update-product-type.provider'
import { DeleteProductTypeProvider } from './delete-product-type.provider'
import { UploadProductTypeImageProvider } from './upload-product-type-image.provider'
import { FindProductTypeImageProvider } from './find-product-type-image.provider'
import { DeleteProductTypeImageProvider } from './delete-product-type-image.provider'

@Injectable()
export class ProductTypesService {
  constructor(
    /**
     * inject find-all product types provider
     */
    private readonly findAllProductTypesProvider: FindAllProductTypesProvider,
    /**
     * inject find-one product type provider
     */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
    /**
     * inject create product type provider
     */
    private readonly createProductTypeProvider: CreateProductTypeProvider,
    /**
     * inject update product type provider
     */
    private readonly updateProductTypeProvider: UpdateProductTypeProvider,
    /**
     * inject delete product type provider
     */
    private readonly deleteProductTypeProvider: DeleteProductTypeProvider,
    /**
     * inject upload product type image provider
     */
    private readonly uploadProductTypeImageProvider: UploadProductTypeImageProvider,
    /**
     * inject find product type image provider
     */
    private readonly findProductTypeImageProvider: FindProductTypeImageProvider,
    /**
     * inject delete product type image provider
     */
    private readonly deleteProductTypeImageProvider: DeleteProductTypeImageProvider,
  ) {}

  public findAll(): Promise<ProductType[]> {
    return this.findAllProductTypesProvider.findAll()
  }

  public findOne(id: number): Promise<ProductType> {
    return this.findOneProductTypeProvider.findOneByIdOrFail(id)
  }

  public findBySlug(slug: string): Promise<ProductType> {
    return this.findOneProductTypeProvider.findOneBySlugOrFail(slug)
  }

  public create(
    dto: CreateProductTypeDto,
    activeUserId: number,
  ): Promise<ProductType> {
    return this.createProductTypeProvider.create(dto, activeUserId)
  }

  public update(
    id: number,
    dto: UpdateProductTypeDto,
    activeUserId: number,
  ): Promise<ProductType> {
    return this.updateProductTypeProvider.update(id, dto, activeUserId)
  }

  public delete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    return this.deleteProductTypeProvider.delete(id, activeUserId)
  }

  public uploadImage(
    file: Express.Multer.File,
    productTypeId: number,
    activeUserId: number,
  ): Promise<ProductType> {
    return this.uploadProductTypeImageProvider.upload(
      file,
      productTypeId,
      activeUserId,
    )
  }

  public findImage(productTypeId: number): Promise<UploadFile> {
    return this.findProductTypeImageProvider.findProductTypeImage(productTypeId)
  }

  public deleteImage(
    productTypeId: number,
    activeUserId: number,
  ): Promise<ProductType> {
    return this.deleteProductTypeImageProvider.deleteImage(
      productTypeId,
      activeUserId,
    )
  }
}
