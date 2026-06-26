import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, Repository } from 'typeorm'
import type { Request } from 'express'
import { Product } from '../entities/product.entity'
import { GetProductsDto } from '../dto/get-products.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindAllProductsProvider {
  private readonly logger = new Logger(FindAllProductsProvider.name)

  constructor(
    /** inject Product repository */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject pagination provider to build paginated responses */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns published products only. Supports optional type and keyword filters.
   * The q filter is an OR across name and shortDescription (case-insensitive).
   */
  public async findAll(
    dto: GetProductsDto,
    request: Request,
  ): Promise<Paginated<Product>> {
    const base: FindOptionsWhere<Product> = { isPublished: true }
    if (dto.productTypeId) {
      base.productTypeId = dto.productTypeId
    }

    // Two search branches (name OR shortDescription) when q is provided.
    const searchBranches: FindOptionsWhere<Product>[] = dto.q
      ? [
          { ...base, name: ILike(`%${dto.q}%`) },
          { ...base, shortDescription: ILike(`%${dto.q}%`) },
        ]
      : [base]

    this.logger.debug(
      `Finding products — page=${dto.page ?? 1}, limit=${dto.limit ?? 10}`,
    )
    return this.paginationProvider.paginateQuery(
      { page: dto.page, limit: dto.limit },
      this.productsRepository,
      searchBranches,
      request,
    )
  }

  /**
   * Admin view — returns all non-deleted products regardless of isPublished.
   * Soft-deleted products are excluded automatically by TypeORM.
   */
  public async findAllAdmin(
    dto: GetProductsDto,
    request: Request,
  ): Promise<Paginated<Product>> {
    const where: FindOptionsWhere<Product> = {}
    if (dto.productTypeId) {
      where.productTypeId = dto.productTypeId
    }

    this.logger.debug(
      `Admin: finding all products — page=${dto.page ?? 1}, limit=${dto.limit ?? 10}`,
    )
    return this.paginationProvider.paginateQuery(
      { page: dto.page, limit: dto.limit },
      this.productsRepository,
      where,
      request,
    )
  }
}
