import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { Product } from '../entities/product.entity'

@Injectable()
export class FindAllProductTypesProvider {
  constructor(
    /** inject ProductType repository for reading type rows */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject Product repository to count published products per type */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Returns all product types ordered by name. No pagination — the set is
   * small and stable; the frontend needs the full list to render the type picker.
   *
   * Each type also carries productCount: the number of published products in
   * that type, for the landing-page cards. The counts come from a single grouped
   * query (not one per type), and soft-deleted products are excluded by TypeORM's
   * default soft-delete handling.
   */
  public async findAll(): Promise<ProductType[]> {
    const types = await this.productTypesRepository.find({
      order: { name: 'ASC' },
    })

    // One grouped query: published product count keyed by productTypeId.
    const rows = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.productTypeId', 'productTypeId')
      .addSelect('COUNT(*)', 'count')
      .where('product.isPublished = :pub', { pub: true })
      .groupBy('product.productTypeId')
      .getRawMany<{ productTypeId: number; count: string }>()

    const counts = new Map<number, number>(
      rows.map((r) => [Number(r.productTypeId), Number(r.count)]),
    )

    // Attach the count to each type, defaulting to 0 when a type has none.
    for (const type of types) {
      type.productCount = counts.get(type.id) ?? 0
    }
    return types
  }
}
