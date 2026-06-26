import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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
   */
  public async findMyPosts(
    userId: number,
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    const where: Record<string, unknown> = { author: { id: userId } }
    if (getPostsDto.status) {
      where['status'] = getPostsDto.status
    }
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
