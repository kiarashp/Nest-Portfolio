import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { PostStatus } from '../enums/postStatus.enum'

@Injectable()
export class FindPostBySlugProvider {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  /**
   * Returns a published post by its slug.
   * Throws NotFoundException for unpublished posts so callers cannot probe
   * whether a draft with that slug exists.
   */
  public async findBySlug(slug: string): Promise<Post> {
    let post: Post | null = null
    try {
      post = await this.postsRepository.findOne({
        where: { slug, status: PostStatus.PUBLISHED },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!post) {
      throw new NotFoundException(`Post with slug "${slug}" not found`)
    }
    return post
  }
}
