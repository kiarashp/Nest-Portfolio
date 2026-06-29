import { Injectable } from '@nestjs/common'
import { PaginationQueryDto } from '../dtos/pagination-query.dto'
import {
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm'
import type { Request } from 'express'
import { Paginated } from '../interfaces/paginated.interface'
@Injectable()
export class PaginationProvider {
  /**
   * Paginates a simple where-based query. Use this when the filter can be
   * expressed as a TypeORM FindOptionsWhere (or an array of them for OR logic).
   */
  public async paginateQuery<T extends ObjectLiteral>(
    paginationQuery: PaginationQueryDto,
    repository: Repository<T>,
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
    request: Request,
  ): Promise<Paginated<T>> {
    // Count before find so that concurrent deletes (e.g. parallel test teardowns) make
    // totalItems >= data.length rather than the reverse, keeping the meta consistent.
    const totalItems = await repository.count({ where })

    const results = await repository.find({
      take: paginationQuery.limit,
      skip: (paginationQuery.page - 1) * paginationQuery.limit,
      where,
    })

    return this.buildResponse(results, totalItems, paginationQuery, request)
  }

  /**
   * Paginates a pre-built QueryBuilder. Use this when the filter needs SQL that
   * a FindOptionsWhere can't express — jsonb containment, numeric casts, joins,
   * custom ordering. The caller configures where/join/orderBy on the builder;
   * this method only adds skip/take and runs count + fetch. Ordering must be set
   * on the builder by the caller (skip/take without an ORDER BY is unstable).
   */
  public async paginateQueryBuilder<T extends ObjectLiteral>(
    paginationQuery: PaginationQueryDto,
    queryBuilder: SelectQueryBuilder<T>,
    request: Request,
  ): Promise<Paginated<T>> {
    // Count first for the same consistency reason as paginateQuery above.
    const totalItems = await queryBuilder.getCount()

    const results = await queryBuilder
      .skip((paginationQuery.page - 1) * paginationQuery.limit)
      .take(paginationQuery.limit)
      .getMany()

    return this.buildResponse(results, totalItems, paginationQuery, request)
  }

  /**
   * Builds the shared paginated response — meta block and absolute first/last/
   * current/next/prev links — from a page of results and the total count. Both
   * paginate methods delegate here so link generation stays in one place.
   */
  private buildResponse<T extends ObjectLiteral>(
    results: T[],
    totalItems: number,
    paginationQuery: PaginationQueryDto,
    request: Request,
  ): Paginated<T> {
    /**
     * Create the request Urls
     */
    const baseURL = request.protocol + '://' + request.headers.host + '/'
    const newURL = new URL(request.url, baseURL)
    const totalPages = Math.ceil(totalItems / paginationQuery.limit)
    const hasNextPage = paginationQuery.page < totalPages
    const nextPage = !hasNextPage
      ? paginationQuery.page
      : paginationQuery.page + 1
    const hasPrevPage = paginationQuery.page > 1
    const prevPage = !hasPrevPage
      ? paginationQuery.page
      : paginationQuery.page - 1

    const finalResponse: Paginated<T> = {
      data: results,
      meta: {
        itemsPerPage: paginationQuery.limit,
        totalItems,
        currentPage: paginationQuery.page,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      links: {
        first: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=1`,
        last: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${totalPages}`,
        current: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${paginationQuery.page}`,
        next: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${nextPage}`,
        prev: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${prevPage}`,
      },
    }
    return finalResponse
  }
}
