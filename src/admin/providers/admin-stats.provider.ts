import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from 'src/posts/entities/post.entity'
import { PostStatus } from 'src/posts/enums/postStatus.enum'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { User } from 'src/users/entities/user.entity'
import { ContactSubmission } from 'src/contact/entities/contact-submission.entity'
import { AdminStatsDto } from '../dto/admin-stats.dto'

@Injectable()
export class AdminStatsProvider {
  constructor(
    /** inject Post repository to count posts by status */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /** inject Product repository to count published/draft products */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject ProductType repository to count product types */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject User repository to count registered users */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    /** inject ContactSubmission repository to count submissions */
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionsRepository: Repository<ContactSubmission>,
  ) {}

  /**
   * Aggregates dashboard counts across posts, products, product types, users,
   * and contact submissions. Every count is read-only and independent of the
   * others, so a failure or slowdown in one aggregate never depends on another.
   */
  public async getStats(): Promise<AdminStatsDto> {
    const postStatusRows = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('post.status')
      .getRawMany<{ status: PostStatus; count: string }>()

    const postsByStatus = { draft: 0, review: 0, scheduled: 0, published: 0 }
    for (const row of postStatusRows) {
      postsByStatus[row.status] = Number(row.count)
    }

    // Product.deletedAt is a @DeleteDateColumn, so soft-deleted products are
    // automatically excluded from both counts.
    const published = await this.productsRepository.count({
      where: { isPublished: true },
    })
    const draft = await this.productsRepository.count({
      where: { isPublished: false },
    })
    const productTypes = await this.productTypesRepository.count()
    const users = await this.usersRepository.count()
    const contactSubmissions = await this.contactSubmissionsRepository.count()

    return {
      posts: postsByStatus,
      products: { published, draft, total: published + draft },
      productTypes,
      users,
      contactSubmissions,
    }
  }
}
