import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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
   */
  public async findAll(getPostsDto: GetPostsDto): Promise<Paginated<Post>> {
    return await this.paginationProvider.paginateQuery(
      { page: getPostsDto.page, limit: getPostsDto.limit },
      this.postsRepository,
      { status: PostStatus.PUBLISHED },
    )
  }
}
