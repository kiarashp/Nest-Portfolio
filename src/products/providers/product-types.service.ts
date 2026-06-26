import { Injectable } from '@nestjs/common'
import { CreateProductTypeDto } from '../dto/create-product-type.dto'
import { UpdateProductTypeDto } from '../dto/update-product-type.dto'
import { ProductType } from '../entities/product-type.entity'
import { FindAllProductTypesProvider } from './find-all-product-types.provider'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { CreateProductTypeProvider } from './create-product-type.provider'
import { UpdateProductTypeProvider } from './update-product-type.provider'
import { DeleteProductTypeProvider } from './delete-product-type.provider'

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
  ) {}

  public findAll(): Promise<ProductType[]> {
    return this.findAllProductTypesProvider.findAll()
  }

  public findOne(id: number): Promise<ProductType> {
    return this.findOneProductTypeProvider.findOneByIdOrFail(id)
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
}
