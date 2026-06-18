import type { Request } from 'express'
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'
import { PaginationProvider } from './pagination.provider'

// Shorthand types so the cast at each call site stays readable.
type AnyRepo = Repository<ObjectLiteral>
type AnyWhere = FindOptionsWhere<ObjectLiteral>

// PaginationProvider is request-scoped (it injects the Express Request object
// to build absolute URLs for the pagination links).
// We instantiate it directly with a mock request instead of going through the
// NestJS DI container — this avoids the complexity of resolving request-scoped
// providers in tests while still fully exercising the pagination logic.
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
    // The mock only covers the three fields the provider reads.
    // `as unknown as Request` is safer than `as any` — it narrows the escape
    // hatch to exactly this cast point instead of silencing type checks globally.
    provider = new PaginationProvider(mockRequest as unknown as Request)
  })

  it('calls repository.find with correct skip and take', async () => {
    // Page 3 with limit 10 → skip = (3-1)*10 = 20 rows.
    mockRepo.find.mockResolvedValue([])
    mockRepo.count.mockResolvedValue(0)

    await provider.paginateQuery(
      { limit: 10, page: 3 },
      mockRepo as unknown as AnyRepo,
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
    )

    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    )
    expect(mockRepo.count).toHaveBeenCalledWith({ where })
  })
})
