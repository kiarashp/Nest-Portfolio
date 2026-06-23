import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { GetPostsDto } from '../dto/get-posts.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { PostStatus } from '../enums/postStatus.enum'

@Injectable()
export class FindAllPostsProvider {
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

    // When tagIds are provided, expand into one where-branch per tag so TypeORM
    // emits OR conditions — a post matching any of the requested tags is returned.
    const where: FindOptionsWhere<Post> | FindOptionsWhere<Post>[] = getPostsDto
      .tagIds?.length
      ? getPostsDto.tagIds.map((id) => ({ ...base, tags: { id } }))
      : base

    return await this.paginationProvider.paginateQuery(
      { page: getPostsDto.page, limit: getPostsDto.limit },
      this.postsRepository,
      where,
    )
  }
}
