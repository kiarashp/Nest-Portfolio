import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import type { Request } from 'express'
import { Product } from '../entities/product.entity'
import { FilterableField, ProductType } from '../entities/product-type.entity'
import {
  GetProductsDto,
  ProductSortField,
  ProductSortOrder,
} from '../dto/get-products.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { findQueryableField } from './validate-specs.util'

@Injectable()
export class FindAllProductsProvider {
  private readonly logger = new Logger(FindAllProductsProvider.name)

  constructor(
    /** inject Product repository */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject ProductType repository to resolve the type behind spec filters */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject pagination provider to build paginated responses */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns published products only. Supports type (id or slug), keyword,
   * spec, and sort filters.
   */
  public async findAll(
    dto: GetProductsDto,
    request: Request,
  ): Promise<Paginated<Product>> {
    const qb = await this.buildQuery(dto, true)
    this.logger.debug(
      `Finding products — page=${dto.page ?? 1}, limit=${dto.limit ?? 10}`,
    )
    return this.paginationProvider.paginateQueryBuilder(
      { page: dto.page, limit: dto.limit },
      qb,
      request,
    )
  }

  /**
   * Admin view — same filters as findAll but includes drafts (no isPublished
   * filter). Soft-deleted products are still excluded by TypeORM automatically.
   */
  public async findAllAdmin(
    dto: GetProductsDto,
    request: Request,
  ): Promise<Paginated<Product>> {
    const qb = await this.buildQuery(dto, false)
    this.logger.debug(
      `Admin: finding all products — page=${dto.page ?? 1}, limit=${dto.limit ?? 10}`,
    )
    return this.paginationProvider.paginateQueryBuilder(
      { page: dto.page, limit: dto.limit },
      qb,
      request,
    )
  }

  /**
   * Builds the products query shared by the public and admin listings.
   * publishedOnly toggles the isPublished filter; everything else is identical.
   */
  private async buildQuery(
    dto: GetProductsDto,
    publishedOnly: boolean,
  ): Promise<SelectQueryBuilder<Product>> {
    // leftJoinAndSelect keeps the (eager) productType in the response — eager
    // relations are not auto-loaded when using a QueryBuilder — and gives the
    // typeSlug filter a column to match on.
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.productType', 'productType')

    if (publishedOnly) {
      qb.andWhere('product.isPublished = :pub', { pub: true })
    } else if (dto.isPublished !== undefined) {
      qb.andWhere('product.isPublished = :pub', { pub: dto.isPublished })
    }

    if (dto.isFeatured !== undefined) {
      qb.andWhere('product.isFeatured = :isFeatured', {
        isFeatured: dto.isFeatured,
      })
    }

    // Type filter — productTypeId takes precedence over typeSlug if both are sent.
    if (dto.productTypeId) {
      qb.andWhere('product.productTypeId = :ptId', { ptId: dto.productTypeId })
    } else if (dto.typeSlug) {
      qb.andWhere('productType.slug = :typeSlug', { typeSlug: dto.typeSlug })
    }

    // Keyword search — OR across name and shortDescription, case-insensitive.
    if (dto.q) {
      qb.andWhere(
        '(product.name ILIKE :q OR product.shortDescription ILIKE :q)',
        { q: `%${dto.q}%` },
      )
    }

    // Spec filters require a single type context so keys can be validated
    // against its filterableFields.
    if (dto.specs && Object.keys(dto.specs).length > 0) {
      const type = await this.resolveTypeForSpecs(dto)
      this.applySpecFilters(qb, dto.specs, type.filterableFields)
    }

    this.applySort(qb, dto.sortBy ?? 'createdAt', dto.order ?? 'desc')
    return qb
  }

  /**
   * Loads the ProductType targeted by a spec-filtered query. Spec filtering only
   * makes sense within one type (filterableFields differ per type), so the
   * caller must supply productTypeId or typeSlug.
   */
  private async resolveTypeForSpecs(dto: GetProductsDto): Promise<ProductType> {
    let type: ProductType | null = null
    if (dto.productTypeId) {
      type = await this.productTypesRepository.findOneBy({
        id: dto.productTypeId,
      })
    } else if (dto.typeSlug) {
      type = await this.productTypesRepository.findOneBy({
        slug: dto.typeSlug,
      })
    } else {
      throw new BadRequestException(
        'Spec filtering requires productTypeId or typeSlug',
      )
    }
    if (!type) {
      throw new BadRequestException(
        'Cannot apply spec filters: product type not found',
      )
    }
    return type
  }

  /**
   * Adds one WHERE condition per spec filter. Enum/string facets match exactly;
   * number facets accept an exact value or a [min]/[max] range. Each key is
   * validated against the type's filterableFields before use, and rejected if
   * the matched field has isFilterable set to false.
   *
   * Values arrive as strings from the bracket-nested query params (a range is a
   * { min, max } object of strings), so number facets are coerced with Number()
   * and rejected if not numeric.
   */
  private applySpecFilters(
    qb: SelectQueryBuilder<Product>,
    specs: Record<string, unknown>,
    fields: FilterableField[] | null | undefined,
  ): void {
    let i = 0
    for (const [key, value] of Object.entries(specs)) {
      const field = findQueryableField(fields, key)
      const keyParam = `specKey${i}`
      qb.setParameter(keyParam, key)

      if (field.type === 'number') {
        // A range arrives as a nested object; a scalar arrives as a string.
        if (typeof value === 'object' && value !== null) {
          const range = value as { min?: unknown; max?: unknown }
          if (range.min !== undefined) {
            const min = Number(range.min)
            if (Number.isNaN(min)) {
              throw new BadRequestException(
                `Spec "${key}" min must be a number`,
              )
            }
            qb.andWhere(
              `(product.specs ->> :${keyParam})::numeric >= :specMin${i}`,
              { [`specMin${i}`]: min },
            )
          }
          if (range.max !== undefined) {
            const max = Number(range.max)
            if (Number.isNaN(max)) {
              throw new BadRequestException(
                `Spec "${key}" max must be a number`,
              )
            }
            qb.andWhere(
              `(product.specs ->> :${keyParam})::numeric <= :specMax${i}`,
              { [`specMax${i}`]: max },
            )
          }
        } else {
          const num = Number(value)
          if (Number.isNaN(num)) {
            throw new BadRequestException(`Spec "${key}" must be a number`)
          }
          qb.andWhere(
            `(product.specs ->> :${keyParam})::numeric = :specVal${i}`,
            { [`specVal${i}`]: num },
          )
        }
      } else {
        // enum/string — exact text match on the jsonb value.
        if (typeof value !== 'string') {
          throw new BadRequestException(`Spec "${key}" filter must be a string`)
        }
        if (field.type === 'enum' && !field.options?.includes(value)) {
          throw new BadRequestException(
            `Spec "${key}" must be one of: ${(field.options ?? []).join(', ')}`,
          )
        }
        qb.andWhere(`(product.specs ->> :${keyParam}) = :specVal${i}`, {
          [`specVal${i}`]: value,
        })
      }
      i++
    }
  }

  /**
   * Applies the sort order. A secondary sort on id keeps pagination stable when
   * the primary key ties (e.g. two products created in the same instant).
   * featured always sorts isFeatured DESC-first — order only controls the
   * direction of the createdAt tiebreak (and of createdAt/name themselves for
   * the other sortBy values).
   */
  private applySort(
    qb: SelectQueryBuilder<Product>,
    sortBy: ProductSortField,
    order: ProductSortOrder,
  ): void {
    const direction = order.toUpperCase() as 'ASC' | 'DESC'
    if (sortBy === 'featured') {
      qb.orderBy('product.isFeatured', 'DESC')
        .addOrderBy('product.createdAt', direction)
        .addOrderBy('product.id', direction)
    } else {
      qb.orderBy(`product.${sortBy}`, direction).addOrderBy(
        'product.id',
        direction,
      )
    }
  }
}
