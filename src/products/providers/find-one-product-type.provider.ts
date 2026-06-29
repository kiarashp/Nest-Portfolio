import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'

@Injectable()
export class FindOneProductTypeProvider {
  constructor(
    /** inject ProductType repository */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
  ) {}

  /**
   * Returns the product type or throws NotFoundException. Used by update and
   * delete providers to load the type before mutating it.
   */
  public async findOneByIdOrFail(id: number): Promise<ProductType> {
    let productType: ProductType | null = null
    try {
      productType = await this.productTypesRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!productType) {
      throw new NotFoundException(`Product type with id ${id} not found`)
    }
    return productType
  }

  /**
   * Returns the product type for a slug or throws NotFoundException. Used by the
   * public per-type page so it can load the type (and its filterableFields) by
   * slug without first resolving the numeric id.
   */
  public async findOneBySlugOrFail(slug: string): Promise<ProductType> {
    let productType: ProductType | null = null
    try {
      productType = await this.productTypesRepository.findOneBy({ slug })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!productType) {
      throw new NotFoundException(`Product type with slug "${slug}" not found`)
    }
    return productType
  }
}
