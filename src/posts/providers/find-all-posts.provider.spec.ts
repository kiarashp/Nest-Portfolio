import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import {
  Between,
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm'
import { FindAllPostsProvider } from './find-all-posts.provider'
import { Post } from '../entities/post.entity'
import { PostStatus } from '../enums/postStatus.enum'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { GetPostsDto } from '../dto/get-posts.dto'

// These tests verify the WHERE clause construction logic in FindAllPostsProvider.
// The repository and PaginationProvider are mocked — we only care about which
// conditions are built, not what the DB returns.
describe('FindAllPostsProvider', () => {
  let provider: FindAllPostsProvider
  let paginationProvider: { paginateQuery: jest.Mock }

  beforeEach(async () => {
    paginationProvider = {
      paginateQuery: jest.fn().mockResolvedValue({
        data: [],
        meta: {
          itemsPerPage: 10,
          totalItems: 0,
          currentPage: 1,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        links: {},
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindAllPostsProvider,
        // The repository is only passed through to PaginationProvider — the
        // provider itself never calls any repo methods directly.
        { provide: getRepositoryToken(Post), useValue: {} },
        { provide: PaginationProvider, useValue: paginationProvider },
      ],
    }).compile()

    provider = module.get(FindAllPostsProvider)
  })

  // Runs findAll and returns the where argument passed to paginateQuery.
  async function getWhereArg(
    dto: Partial<GetPostsDto>,
  ): Promise<FindOptionsWhere<Post>[]> {
    await provider.findAll(dto as GetPostsDto)
    const calls = paginationProvider.paginateQuery.mock.calls as [
      unknown,
      unknown,
      FindOptionsWhere<Post>[],
    ][]
    return calls[0][2]
  }

  // ── Base filter ───────────────────────────────────────────────────────────

  it('no filters → single branch with status=PUBLISHED only', async () => {
    const where = await getWhereArg({})
    expect(where).toHaveLength(1)
    expect(where[0]).toEqual({ status: PostStatus.PUBLISHED })
  })

  // ── Keyword search (q) ────────────────────────────────────────────────────

  it('q only → two branches: title ILike and content ILike, both with status=PUBLISHED', async () => {
    const where = await getWhereArg({ q: 'hello' })
    expect(where).toHaveLength(2)
    expect(where[0]).toEqual({
      status: PostStatus.PUBLISHED,
      title: ILike('%hello%'),
    })
    expect(where[1]).toEqual({
      status: PostStatus.PUBLISHED,
      content: ILike('%hello%'),
    })
  })

  // ── Tag filter (tagIds) ───────────────────────────────────────────────────

  it('tagIds → one branch per tag, each with status=PUBLISHED', async () => {
    const where = await getWhereArg({ tagIds: [1, 2] })
    expect(where).toHaveLength(2)
    expect(where[0]).toEqual({ status: PostStatus.PUBLISHED, tags: { id: 1 } })
    expect(where[1]).toEqual({ status: PostStatus.PUBLISHED, tags: { id: 2 } })
  })

  // ── Cross-product: q × tagIds ─────────────────────────────────────────────

  it('q + one tagId → 2 branches (title×tag and content×tag)', async () => {
    const where = await getWhereArg({ q: 'world', tagIds: [5] })
    expect(where).toHaveLength(2)
    expect(where[0]).toEqual({
      status: PostStatus.PUBLISHED,
      title: ILike('%world%'),
      tags: { id: 5 },
    })
    expect(where[1]).toEqual({
      status: PostStatus.PUBLISHED,
      content: ILike('%world%'),
      tags: { id: 5 },
    })
  })

  it('q + two tagIds → 4 branches (2 search columns × 2 tags)', async () => {
    const where = await getWhereArg({ q: 'nest', tagIds: [3, 4] })
    expect(where).toHaveLength(4)
  })

  // ── Author filter ─────────────────────────────────────────────────────────

  it('authorId → appears in every branch', async () => {
    const where = await getWhereArg({ authorId: 7 })
    expect(where).toHaveLength(1)
    expect(where[0]).toEqual({
      status: PostStatus.PUBLISHED,
      author: { id: 7 },
    })
  })

  it('authorId + q → author appears in both search branches', async () => {
    const where = await getWhereArg({ authorId: 7, q: 'test' })
    expect(where).toHaveLength(2)
    for (const branch of where) {
      expect(branch.author).toEqual({ id: 7 })
    }
  })

  // ── Date range ────────────────────────────────────────────────────────────

  it('startDate + endDate → Between applied to createdAt', async () => {
    const start = new Date('2025-01-01')
    const end = new Date('2025-12-31')
    const where = await getWhereArg({ startDate: start, endDate: end })
    expect(where).toHaveLength(1)
    expect(where[0].createdAt).toEqual(Between(start, end))
  })

  it('startDate only → MoreThanOrEqual applied to createdAt', async () => {
    const start = new Date('2025-01-01')
    const where = await getWhereArg({ startDate: start })
    expect(where[0].createdAt).toEqual(MoreThanOrEqual(start))
  })

  it('endDate only → LessThanOrEqual applied to createdAt', async () => {
    const end = new Date('2025-12-31')
    const where = await getWhereArg({ endDate: end })
    expect(where[0].createdAt).toEqual(LessThanOrEqual(end))
  })
})
