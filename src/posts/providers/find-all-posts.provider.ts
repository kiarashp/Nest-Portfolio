import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import { Post } from '../entities/post.entity'
import { GetPostsDto } from '../dto/get-posts.dto'
import type { Request } from 'express'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { PostStatus } from '../enums/postStatus.enum'
import { applyPostSort } from './apply-post-sort.util'

@Injectable()
export class FindAllPostsProvider {
  private readonly logger = new Logger(FindAllPostsProvider.name)

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
   * Builds the posts query shared by the public and admin listings.
   * publishedOnly locks status to PUBLISHED (public route); otherwise status
   * is either from the DTO filter or unrestricted (admin route).
   */
  private buildQuery(
    getPostsDto: GetPostsDto,
    publishedOnly: boolean,
  ): SelectQueryBuilder<Post> {
    // leftJoinAndSelect keeps the (eager) author/tags in the response — eager
    // relations are not auto-loaded when using a QueryBuilder.
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.tags', 'tags')

    if (publishedOnly) {
      qb.andWhere('post.status = :status', { status: PostStatus.PUBLISHED })
    } else if (getPostsDto.status) {
      qb.andWhere('post.status = :status', { status: getPostsDto.status })
    }

    if (getPostsDto.authorId) {
      qb.andWhere('author.id = :authorId', { authorId: getPostsDto.authorId })
    }

    // Date range filter on createdAt — supports open-ended ranges (one side only).
    if (getPostsDto.startDate && getPostsDto.endDate) {
      qb.andWhere('post.createdAt BETWEEN :startDate AND :endDate', {
        startDate: getPostsDto.startDate,
        endDate: getPostsDto.endDate,
      })
    } else if (getPostsDto.startDate) {
      qb.andWhere('post.createdAt >= :startDate', {
        startDate: getPostsDto.startDate,
      })
    } else if (getPostsDto.endDate) {
      qb.andWhere('post.createdAt <= :endDate', {
        endDate: getPostsDto.endDate,
      })
    }

    // Keyword search — OR across title and content, case-insensitive.
    if (getPostsDto.q) {
      qb.andWhere('(post.title ILIKE :q OR post.content ILIKE :q)', {
        q: `%${getPostsDto.q}%`,
      })
    }

    // Tag filter — OR logic across tag IDs. Uses a subquery on the join table
    // rather than a condition on the 'tags' join alias above: filtering on that
    // alias would also restrict which tags get selected (only the matching
    // ones), when a post's full tag list should always be returned.
    if (getPostsDto.tagIds?.length) {
      const tagPostIdsSubQuery = qb
        .subQuery()
        .select('pt."postId"')
        .from('post_tags_tag', 'pt')
        .where('pt."tagId" IN (:...tagIds)')
        .getQuery()
      qb.andWhere(`post.id IN ${tagPostIdsSubQuery}`, {
        tagIds: getPostsDto.tagIds,
      })
    }

    applyPostSort(
      qb,
      getPostsDto.sortBy ?? 'createdAt',
      getPostsDto.order ?? 'desc',
    )
    return qb
  }

  /**
   * Returns a paginated list of published posts only.
   * Draft, scheduled, and review posts are never returned to public callers.
   * Supports optional filtering by one or more tag IDs (OR logic) and by author ID.
   */
  public async findAll(
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    const qb = this.buildQuery(getPostsDto, true)
    this.logger.debug(
      `Finding posts — page=${getPostsDto.page ?? 1}, limit=${getPostsDto.limit ?? 10}`,
    )
    return await this.paginationProvider.paginateQueryBuilder(
      getPostsDto,
      qb,
      request,
    )
  }

  /**
   * Admin variant — returns all posts regardless of status.
   * Pass status in the DTO to narrow to a specific status; omit it to get everything.
   */
  public async findAllAdmin(
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    const qb = this.buildQuery(getPostsDto, false)
    this.logger.debug(
      `Admin: finding posts — page=${getPostsDto.page ?? 1}, limit=${getPostsDto.limit ?? 10}`,
    )
    return await this.paginationProvider.paginateQueryBuilder(
      getPostsDto,
      qb,
      request,
    )
  }
}
