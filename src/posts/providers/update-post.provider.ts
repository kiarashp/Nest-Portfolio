import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { PatchPostDto } from '../dto/update-post.dto'
import { TagsService } from 'src/tags/providers/tags.service'
import { FindOnePostProvider } from './find-one-post.provider'

@Injectable()
export class UpdatePostProvider {
  constructor(
    /**
     * inject `Post` repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /**
     * inject tags service to validate and resolve tag ids
     */
    private readonly tagsService: TagsService,
    /**
     * inject find one post provider to look up the post
     */
    private readonly findOnePostProvider: FindOnePostProvider,
  ) {}

  /**
   * Updates a post's fields and optionally its tags.
   */
  public async update(id: number, patchPostDto: PatchPostDto): Promise<Post> {
    // Step 1: resolve tags if provided, and validate they all exist.
    let tags: Tag[] | null = null
    if (patchPostDto.tags) {
      try {
        tags = await this.tagsService.findMany(patchPostDto.tags)
      } catch {
        throw new RequestTimeoutException(
          'Unable to process your request, please try again later',
        )
      }
      if (!tags || tags.length !== patchPostDto.tags.length) {
        throw new BadRequestException('please check the tags ID and try again')
      }
    }

    // Step 2: find the post, throws NotFoundException if missing.
    const post = await this.findOnePostProvider.findOneByIdOrFail(id)

    // Step 3: apply the updates.
    post.title = patchPostDto.title ?? post.title
    post.postType = patchPostDto.postType ?? post.postType
    post.slug = patchPostDto.slug ?? post.slug
    post.status = patchPostDto.status ?? post.status
    post.content = patchPostDto.content ?? post.content
    post.featuredImage = patchPostDto.featuredImage ?? post.featuredImage
    post.publishOn = patchPostDto.publishOn ?? post.publishOn
    if (tags) {
      post.tags = tags
    }

    // Step 4: persist.
    try {
      return await this.postsRepository.save(post)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}