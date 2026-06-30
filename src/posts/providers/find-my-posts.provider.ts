import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { GetPostsDto } from '../dto/get-posts.dto'
import type { Request } from 'express'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

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
    const base: FindOptionsWhere<Post> = { author: { id: userId } }
    if (getPostsDto.status) {
      base.status = getPostsDto.status
    }

    // Keyword search: two branches (title OR content) when q is provided.
    const searchBranches: FindOptionsWhere<Post>[] = getPostsDto.q
      ? [
          { title: ILike(`%${getPostsDto.q}%`) },
          { content: ILike(`%${getPostsDto.q}%`) },
        ]
      : [{}]

    const where: FindOptionsWhere<Post>[] = searchBranches.map((sf) => ({
      ...base,
      ...sf,
    }))

    this.logger.debug(
      `Finding posts for userId=${userId} — page=${getPostsDto.page ?? 1}, limit=${getPostsDto.limit ?? 10}`,
    )
    return await this.paginationProvider.paginateQuery(
      { page: getPostsDto.page, limit: getPostsDto.limit },
      this.postsRepository,
      where,
      request,
    )
  }
}
