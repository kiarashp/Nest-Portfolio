import type { Request } from 'express'
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'
import { PaginationProvider } from './pagination.provider'

// Shorthand types so the cast at each call site stays readable.
type AnyRepo = Repository<ObjectLiteral>
type AnyWhere = FindOptionsWhere<ObjectLiteral>

// PaginationProvider is a singleton — it no longer injects the Express Request.
// Instead, the request is passed as a method argument, which is simpler to test.
describe('PaginationProvider', () => {
  let provider: PaginationProvider
  let mockRepo: { find: jest.Mock; count: jest.Mock }

  // The mock request only needs the fields the provider reads to build links.
  const mockRequest = {
    protocol: 'http',
    headers: { host: 'localhost:3000' },
    url: '/posts?limit=10&page=1',
  }

  beforeEach(() => {
    mockRepo = { find: jest.fn(), count: jest.fn() }
    provider = new PaginationProvider()
  })

  it('calls repository.find with correct skip and take', async () => {
    // Page 3 with limit 10 → skip = (3-1)*10 = 20 rows.
    mockRepo.find.mockResolvedValue([])
    mockRepo.count.mockResolvedValue(0)

    await provider.paginateQuery(
      { limit: 10, page: 3 },
      mockRepo as unknown as AnyRepo,
      undefined,
      mockRequest as unknown as Request,
    )

    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    )
  })

  it('returns correct meta for a middle page', async () => {
    // 30 items total, 10 per page, on page 2 → prev and next both exist.
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))
    mockRepo.find.mockResolvedValue(items)
    mockRepo.count.mockResolvedValue(30)

    const result = await provider.paginateQuery(
      { limit: 10, page: 2 },
      mockRepo as unknown as AnyRepo,
      undefined,
      mockRequest as unknown as Request,
    )

    expect(result.meta).toEqual({
      itemsPerPage: 10,
      totalItems: 30,
      currentPage: 2,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    })
    expect(result.data).toEqual(items)
  })

  it('returns hasPrevPage=false and prev link pointing to page 1 on the first page', async () => {
    // On page 1 there is no previous page, but the prev link still exists
    // and should point back to page 1 (not break or point to page 0).
    mockRepo.find.mockResolvedValue([])
    mockRepo.count.mockResolvedValue(20)

    const result = await provider.paginateQuery(
      { limit: 10, page: 1 },
      mockRepo as unknown as AnyRepo,
      undefined,
      mockRequest as unknown as Request,
    )

    expect(result.meta.hasPrevPage).toBe(false)
    expect(result.meta.hasNextPage).toBe(true)
    expect(result.links.prev).toContain('page=1')
  })

  it('returns hasNextPage=false and next link pointing to last page on the final page', async () => {
    // On the last page there is no next page, but the next link still exists
    // and should point to the last page (not break or overflow).
    mockRepo.find.mockResolvedValue([])
    mockRepo.count.mockResolvedValue(20)

    const result = await provider.paginateQuery(
      { limit: 10, page: 2 },
      mockRepo as unknown as AnyRepo,
      undefined,
      mockRequest as unknown as Request,
    )

    expect(result.meta.hasNextPage).toBe(false)
    expect(result.meta.hasPrevPage).toBe(true)
    expect(result.links.next).toContain('page=2')
  })

  it('generates links containing the host from the request', async () => {
    // Links are absolute URLs built from the incoming request's protocol and host,
    // so clients can use them directly without knowing the server's base URL.
    mockRepo.find.mockResolvedValue([])
    mockRepo.count.mockResolvedValue(10)

    const result = await provider.paginateQuery(
      { limit: 10, page: 1 },
      mockRepo as unknown as AnyRepo,
      undefined,
      mockRequest as unknown as Request,
    )

    expect(result.links.first).toContain('http://localhost:3000')
    expect(result.links.first).toContain('limit=10&page=1')
  })

  it('passes the where clause to both find and count', async () => {
    // The where filter must be applied to the count as well as the find —
    // otherwise totalPages would be calculated against the full table,
    // not the filtered subset, and the link URLs would be wrong.
    mockRepo.find.mockResolvedValue([])
    mockRepo.count.mockResolvedValue(5)
    const where = { status: 'published' }

    await provider.paginateQuery(
      { limit: 5, page: 1 },
      mockRepo as unknown as AnyRepo,
      where,
      mockRequest as unknown as Request,
    )

    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    )
    expect(mockRepo.count).toHaveBeenCalledWith({ where })
  })

  describe('paginateQueryBuilder', () => {
    // Minimal stub of a SelectQueryBuilder: skip/take return the builder so the
    // provider can chain them, getCount/getMany return the data under test.
    interface QbStub {
      skip: jest.Mock
      take: jest.Mock
      getCount: jest.Mock
      getMany: jest.Mock
    }
    function makeQb(count: number, rows: unknown[]): QbStub {
      const qb: QbStub = {
        skip: jest.fn(),
        take: jest.fn(),
        getCount: jest.fn().mockResolvedValue(count),
        getMany: jest.fn().mockResolvedValue(rows),
      }
      qb.skip.mockReturnValue(qb)
      qb.take.mockReturnValue(qb)
      return qb
    }

    it('applies skip and take from the page/limit', async () => {
      const qb = makeQb(0, [])
      // Page 3, limit 10 → skip = (3-1)*10 = 20, take = 10.
      await provider.paginateQueryBuilder(
        { limit: 10, page: 3 },
        qb as never,
        mockRequest as unknown as Request,
      )

      expect(qb.skip).toHaveBeenCalledWith(20)
      expect(qb.take).toHaveBeenCalledWith(10)
    })

    it('builds meta and data from getCount and getMany', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))
      const qb = makeQb(30, rows)

      const result = await provider.paginateQueryBuilder(
        { limit: 10, page: 2 },
        qb as never,
        mockRequest as unknown as Request,
      )

      expect(result.meta).toEqual({
        itemsPerPage: 10,
        totalItems: 30,
        currentPage: 2,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      })
      expect(result.data).toEqual(rows)
      expect(result.links.first).toContain('http://localhost:3000')
    })
  })
})
