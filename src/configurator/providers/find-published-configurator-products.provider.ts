import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { ConfiguratorListItemDto } from '../dtos/configurator-list-item.dto'

@Injectable()
export class FindPublishedConfiguratorProductsProvider {
  constructor(
    /** inject ConfigurableProduct repository to read published rows */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
  ) {}

  /**
   * Returns every published configurable product, ordered by name, curated
   * to the fields a browse page needs (slug, name, description, imageUrl).
   * No pagination — this is a small browse catalog, not expected to grow
   * into the hundreds, matching GET /product-types. Soft-deleted rows are
   * excluded automatically by the @DeleteDateColumn, the same default
   * FindOneConfigurableProductProvider.findOneBySlugPublishedOrFail relies on.
   */
  public async findPublishedList(): Promise<ConfiguratorListItemDto[]> {
    const products = await this.configurableProductsRepository.find({
      where: { isPublished: true },
      order: { name: 'ASC' },
    })
    return products.map((product) => ({
      slug: product.slug,
      name: product.name,
      description: product.description ?? null,
      imageUrl: product.imageUrl ?? null,
    }))
  }
}
