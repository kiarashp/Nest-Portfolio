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
   * rows are excluded automatically. Includes its assignments (ordered by
   * position) with each assignment's definition and, for SELECT definitions,
   * its options (ordered by sortOrder) — this is what makes GET
   * /configurator-products/:id return the ordered assignment tree per
   * CONFIGURATOR.md §5.1. Used by the single-record read and reused by the
   * update/delete/image/assignment providers to load before mutating; those
   * providers accept the extra relation-load cost for reuse, the same
   * tradeoff FindOneSegmentDefinitionProvider already makes for options.
   */
  public async findOneByIdOrFail(id: number): Promise<ConfigurableProduct> {
    let product: ConfigurableProduct | null = null
    try {
      product = await this.configurableProductsRepository.findOne({
        where: { id },
        relations: { assignments: { definition: { options: true } } },
        order: {
          assignments: {
            position: 'ASC',
            definition: { options: { sortOrder: 'ASC' } },
          },
        },
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
