import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import {
  Between,
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm'
import { Post } from '../entities/post.entity'
import { GetPostsDto } from '../dto/get-posts.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { PostStatus } from '../enums/postStatus.enum'

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
   * Returns a paginated list of published posts only.
   * Draft, scheduled, and review posts are never returned to public callers.
   * Supports optional filtering by one or more tag IDs (OR logic) and by author ID.
   */
  public async findAll(getPostsDto: GetPostsDto): Promise<Paginated<Post>> {
    // always filter to published posts only; add author filter if provided
    const base: FindOptionsWhere<Post> = { status: PostStatus.PUBLISHED }
    if (getPostsDto.authorId) {
      base.author = { id: getPostsDto.authorId }
    }
    // Wire date range filter onto createdAt — supports open-ended ranges (one side only)
    if (getPostsDto.startDate && getPostsDto.endDate) {
      base.createdAt = Between(getPostsDto.startDate, getPostsDto.endDate)
    } else if (getPostsDto.startDate) {
      base.createdAt = MoreThanOrEqual(getPostsDto.startDate)
    } else if (getPostsDto.endDate) {
      base.createdAt = LessThanOrEqual(getPostsDto.endDate)
    }

    // Keyword search: two branches (title OR content) when q is provided.
    // Empty branch ({}) when absent — merges cleanly in the cross-product below.
    const searchBranches: FindOptionsWhere<Post>[] = getPostsDto.q
      ? [
          { title: ILike(`%${getPostsDto.q}%`) },
          { content: ILike(`%${getPostsDto.q}%`) },
        ]
      : [{}]

    // Tag branches: one per tagId for OR logic. Empty branch when absent.
    const tagBranches: FindOptionsWhere<Post>[] = getPostsDto.tagIds?.length
      ? getPostsDto.tagIds.map((id) => ({ tags: { id } }))
      : [{}]

    // Cross-product of search × tag branches merged with base gives correct
    // AND semantics: PUBLISHED AND (title OR content) AND (tag1 OR tag2).
    const where: FindOptionsWhere<Post>[] = searchBranches.flatMap((sf) =>
      tagBranches.map((tb) => ({ ...base, ...sf, ...tb })),
    )

    this.logger.debug(
      `Finding posts — page=${getPostsDto.page ?? 1}, limit=${getPostsDto.limit ?? 10}`,
    )
    return await this.paginationProvider.paginateQuery(
      { page: getPostsDto.page, limit: getPostsDto.limit },
      this.postsRepository,
      where,
    )
  }
}
