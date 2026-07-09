import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'

@Injectable()
export class FindOneConfigurableProductProvider {
  constructor(
    /** inject ConfigurableProduct repository */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
  ) {}

  /**
   * Returns a configurable product by id, regardless of isPublished — this is
   * the admin view, so unpublished products are visible here too. Soft-deleted
   * rows are excluded automatically. Used by the single-record read and reused
   * by the update/delete/image providers to load before mutating.
   */
  public async findOneByIdOrFail(id: number): Promise<ConfigurableProduct> {
    let product: ConfigurableProduct | null = null
    try {
      product = await this.configurableProductsRepository.findOne({
        where: { id },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!product) {
      throw new NotFoundException(
        `Configurable product with id ${id} not found`,
      )
    }
    return product
  }
}
