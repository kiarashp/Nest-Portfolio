import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { GetPostsDto } from '../dto/get-posts.dto'
import type { Request } from 'express'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { applyPostSort } from './apply-post-sort.util'

@Injectable()
export class FindMyPostsProvider {
  private readonly logger = new Logger(FindMyPostsProvider.name)

  constructor(
    /**
     * inject `Post` repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /**
     * inject pagination provider
     */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of the authenticated user's own posts.
   * All statuses are returned by default; pass `status` in the DTO to filter to one.
   * Pass `q` to search by keyword across title and content (case-insensitive).
   */
  public async findMyPosts(
    userId: number,
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    // leftJoinAndSelect keeps the (eager) author/tags in the response — eager
    // relations are not auto-loaded when using a QueryBuilder.
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.tags', 'tags')
      .andWhere('author.id = :userId', { userId })

    if (getPostsDto.status) {
      qb.andWhere('post.status = :status', { status: getPostsDto.status })
    }

    // Keyword search — OR across title and content, case-insensitive.
    if (getPostsDto.q) {
      qb.andWhere('(post.title ILIKE :q OR post.content ILIKE :q)', {
        q: `%${getPostsDto.q}%`,
      })
    }

    applyPostSort(
      qb,
      getPostsDto.sortBy ?? 'createdAt',
      getPostsDto.order ?? 'desc',
    )

    this.logger.debug(
      `Finding posts for userId=${userId} — page=${getPostsDto.page ?? 1}, limit=${getPostsDto.limit ?? 10}`,
    )
    return await this.paginationProvider.paginateQueryBuilder(
      getPostsDto,
      qb,
      request,
    )
  }
}
