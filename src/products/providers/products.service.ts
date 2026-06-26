import { Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { CreateProductDto } from '../dto/create-product.dto'
import { UpdateProductDto } from '../dto/update-product.dto'
import { GetProductsDto } from '../dto/get-products.dto'
import { Product } from '../entities/product.entity'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { FindAllProductsProvider } from './find-all-products.provider'
import { FindOneProductProvider } from './find-one-product.provider'
import { CreateProductProvider } from './create-product.provider'
import { UpdateProductProvider } from './update-product.provider'
import { DeleteProductProvider } from './delete-product.provider'
import { UploadProductImageProvider } from './upload-product-image.provider'

@Injectable()
export class ProductsService {
  constructor(
    /**
     * inject find-all products provider
     */
    private readonly findAllProductsProvider: FindAllProductsProvider,
    /**
     * inject find-one product provider
     */
    private readonly findOneProductProvider: FindOneProductProvider,
    /**
     * inject create product provider
     */
    private readonly createProductProvider: CreateProductProvider,
    /**
     * inject update product provider
     */
    private readonly updateProductProvider: UpdateProductProvider,
    /**
     * inject delete product provider
     */
    private readonly deleteProductProvider: DeleteProductProvider,
    /**
     * inject upload product image provider
     */
    private readonly uploadProductImageProvider: UploadProductImageProvider,
  ) {}

  public findAll(
    dto: GetProductsDto,
    request: Request,
  ): Promise<Paginated<Product>> {
    return this.findAllProductsProvider.findAll(dto, request)
  }

  public findAllAdmin(
    dto: GetProductsDto,
    request: Request,
  ): Promise<Paginated<Product>> {
    return this.findAllProductsProvider.findAllAdmin(dto, request)
  }

  public findOne(id: number): Promise<Product> {
    return this.findOneProductProvider.findOnePublishedByIdOrFail(id)
  }

  public findBySlug(slug: string): Promise<Product> {
    return this.findOneProductProvider.findOneBySlugOrFail(slug)
  }

  public create(dto: CreateProductDto, activeUserId: number): Promise<Product> {
    return this.createProductProvider.create(dto, activeUserId)
  }

  public update(
    id: number,
    dto: UpdateProductDto,
    activeUserId: number,
  ): Promise<Product> {
    return this.updateProductProvider.update(id, dto, activeUserId)
  }

  public softDelete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    return this.deleteProductProvider.softDelete(id, activeUserId)
  }

  public uploadImage(
    file: Express.Multer.File,
    productId: number,
    activeUserId: number,
  ): Promise<Product> {
    return this.uploadProductImageProvider.upload(file, productId, activeUserId)
  }
}
