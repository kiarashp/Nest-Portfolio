import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AdminStatsProvider } from './admin-stats.provider'
import { Post } from 'src/posts/entities/post.entity'
import { PostStatus } from 'src/posts/enums/postStatus.enum'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { User } from 'src/users/entities/user.entity'
import { ContactSubmission } from 'src/contact/entities/contact-submission.entity'

describe('AdminStatsProvider', () => {
  let provider: AdminStatsProvider
  let postsQueryBuilder: {
    select: jest.Mock
    addSelect: jest.Mock
    groupBy: jest.Mock
    getRawMany: jest.Mock
  }
  let productsRepo: { count: jest.Mock }
  let productTypesRepo: { count: jest.Mock }
  let usersRepo: { count: jest.Mock }
  let contactSubmissionsRepo: { count: jest.Mock }

  beforeEach(async () => {
    postsQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: PostStatus.PUBLISHED, count: '10' },
        { status: PostStatus.DRAFT, count: '3' },
      ]),
    }
    productsRepo = { count: jest.fn() }
    productTypesRepo = { count: jest.fn().mockResolvedValue(4) }
    usersRepo = { count: jest.fn().mockResolvedValue(12) }
    contactSubmissionsRepo = { count: jest.fn().mockResolvedValue(37) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminStatsProvider,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(postsQueryBuilder),
          },
        },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        {
          provide: getRepositoryToken(ProductType),
          useValue: productTypesRepo,
        },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        {
          provide: getRepositoryToken(ContactSubmission),
          useValue: contactSubmissionsRepo,
        },
      ],
    }).compile()

    provider = module.get(AdminStatsProvider)
  })

  it('defaults post statuses with no rows to 0', async () => {
    productsRepo.count.mockResolvedValueOnce(20).mockResolvedValueOnce(5)

    const stats = await provider.getStats()

    expect(stats.posts).toEqual({
      draft: 3,
      review: 0,
      scheduled: 0,
      published: 10,
    })
  })

  it('sets products.total to published + draft', async () => {
    productsRepo.count.mockResolvedValueOnce(20).mockResolvedValueOnce(5)

    const stats = await provider.getStats()

    expect(stats.products).toEqual({ published: 20, draft: 5, total: 25 })
  })

  it('returns the full aggregated shape', async () => {
    productsRepo.count.mockResolvedValueOnce(20).mockResolvedValueOnce(5)

    const stats = await provider.getStats()

    expect(stats).toEqual({
      posts: { draft: 3, review: 0, scheduled: 0, published: 10 },
      products: { published: 20, draft: 5, total: 25 },
      productTypes: 4,
      users: 12,
      contactSubmissions: 37,
    })
  })
})
