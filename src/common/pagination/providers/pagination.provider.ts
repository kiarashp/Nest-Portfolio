import { Injectable } from '@nestjs/common'
import { PaginationQueryDto } from '../dtos/pagination-query.dto'
import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'
import type { Request } from 'express'
import { Paginated } from '../interfaces/paginated.interface'
@Injectable()
export class PaginationProvider {
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
