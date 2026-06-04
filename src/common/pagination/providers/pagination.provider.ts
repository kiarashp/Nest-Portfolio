import { Injectable, Inject } from '@nestjs/common'
import { PaginationQueryDto } from '../dtos/pagination-query.dto'
import { ObjectLiteral, Repository } from 'typeorm'
import type { Request } from 'express'
import { REQUEST } from '@nestjs/core'
import { Paginated } from '../interfaces/paginated.interface'
@Injectable()
export class PaginationProvider {
  constructor(
    /**
     * Injecting request
     */
    @Inject(REQUEST)
    private readonly request: Request,
  ) {}
  public async paginateQuery<T extends ObjectLiteral>(
    paginationQuery: PaginationQueryDto,
    repository: Repository<T>,
  ): Promise<Paginated<T>> {
    const results = await repository.find({
      take: paginationQuery.limit,
      skip: (paginationQuery.page - 1) * paginationQuery.limit,
    })
    /**
     * Create the request Urls
     */
    const baseURL =
      this.request.protocol + '://' + this.request.headers.host + '/'
    const newURL = new URL(this.request.url, baseURL)
    console.log(newURL)
    /**
     * Calculate page numbers
     */
    const totalItems = await repository.count()
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
