import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'

@Injectable()
export class FindOnePostProvider {
  constructor(
    /**
     * inject `Post` repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  /**
   * Returns the post or null if not found. Use when the caller needs to decide
   * what to do with a missing post (e.g. check existence before creating).
   */
  public async findOneById(id: number): Promise<Post | null> {
    try {
      return await this.postsRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }

  /**
   * Returns the post or throws NotFoundException. Use when a missing post is
   * always an error (most controller-facing operations).
   */
  public async findOneByIdOrFail(id: number): Promise<Post> {
    const post = await this.findOneById(id)
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`)
    }
    return post
  }
}
