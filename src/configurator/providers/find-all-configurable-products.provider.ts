import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Request } from 'express'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { GetConfiguratorProductsDto } from '../dtos/get-configurator-products.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

@Injectable()
export class FindAllConfigurableProductsProvider {
  constructor(
    /** inject ConfigurableProduct repository to build the list query */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
    /** inject shared pagination provider */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of configurable products, newest first. This is
   * the admin view — unpublished products are included; soft-deleted rows are
   * excluded automatically by the @DeleteDateColumn.
   */
  public async findAll(
    dto: GetConfiguratorProductsDto,
    request: Request,
  ): Promise<Paginated<ConfigurableProduct>> {
    const qb = this.configurableProductsRepository
      .createQueryBuilder('configurableProduct')
      .orderBy('configurableProduct.createdAt', 'DESC')
      .addOrderBy('configurableProduct.id', 'DESC')

    return await this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
