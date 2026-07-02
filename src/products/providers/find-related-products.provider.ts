import { Injectable, RequestTimeoutException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { FindOneProductProvider } from './find-one-product.provider'

/** Number of related products returned when the caller does not send ?limit. */
const DEFAULT_RELATED_LIMIT = 4

@Injectable()
export class FindRelatedProductsProvider {
  constructor(
    /** inject Product repository */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject find-one product provider, used to resolve and validate the anchor product */
    private readonly findOneProductProvider: FindOneProductProvider,
  ) {}

  /**
   * Returns up to `limit` other published products that share the anchor
   * product's type, newest first, excluding the anchor itself. The anchor
   * is resolved with the same published-only rule as GET /products/:id, so
   * a missing or unpublished id 404s instead of returning an empty array.
   * There is no fallback to other product types, so the result can be
   * shorter than `limit` or empty if too few same-type siblings exist.
   */
  public async findRelated(
    id: number,
    limit: number = DEFAULT_RELATED_LIMIT,
  ): Promise<Product[]> {
    const anchor =
      await this.findOneProductProvider.findOnePublishedByIdOrFail(id)

    try {
      return await this.productsRepository.find({
        where: {
          productTypeId: anchor.productTypeId,
          id: Not(anchor.id),
          isPublished: true,
        },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: limit,
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
