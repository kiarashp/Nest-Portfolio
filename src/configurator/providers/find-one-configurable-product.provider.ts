import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsOrder, FindOptionsRelations, Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'

@Injectable()
export class FindOneConfigurableProductProvider {
  // The full assignment tree every read of a configurable product needs:
  // assignments (ordered by position) with each assignment's definition and,
  // for SELECT definitions, its options (ordered by sortOrder) — per
  // CONFIGURATOR.md §5.1/§5.2. Shared by the admin and public lookups below.
  private readonly assignmentTreeRelations: FindOptionsRelations<ConfigurableProduct> =
    { assignments: { definition: { options: true } } }

  private readonly assignmentTreeOrder: FindOptionsOrder<ConfigurableProduct> =
    {
      assignments: {
        position: 'ASC',
        definition: { options: { sortOrder: 'ASC' } },
      },
    }

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
        relations: this.assignmentTreeRelations,
        order: this.assignmentTreeOrder,
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

  /**
   * Returns a published configurable product by slug, with the same ordered
   * assignment tree as findOneByIdOrFail — this is the public view backing
   * GET /configurators/:slug and POST /configurators/:slug/resolve. The
   * isPublished filter makes unpublished products 404 for the public (same
   * rule as product drafts); soft-deleted rows are excluded automatically.
   */
  public async findOneBySlugPublishedOrFail(
    slug: string,
  ): Promise<ConfigurableProduct> {
    let product: ConfigurableProduct | null = null
    try {
      product = await this.configurableProductsRepository.findOne({
        where: { slug, isPublished: true },
        relations: this.assignmentTreeRelations,
        order: this.assignmentTreeOrder,
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!product) {
      throw new NotFoundException(`Configurator "${slug}" not found`)
    }
    return product
  }
}
