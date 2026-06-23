import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { FindOnePostProvider } from './find-one-post.provider'
import { TagsService } from 'src/tags/providers/tags.service'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class ManagePostTagsProvider {
  constructor(
    /**
     * inject `Post` repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /**
     * inject find one post provider to look up the post
     */
    private readonly findOnePostProvider: FindOnePostProvider,
    /**
     * inject tags service to validate and resolve tag ids
     */
    private readonly tagsService: TagsService,
  ) {}

  /**
   * Adds the given tags to a post. Tags already on the post are skipped — no duplicates are added.
   * Editors can only modify posts they created.
   * Warning: if two requests hit this at the same time on the same post, the second save will
   * overwrite the first. This is fine for a small team but worth knowing.
   */
  public async addTags(
    postId: number,
    tagIds: number[],
    activeUser: ActiveUserData,
  ): Promise<Post> {
    const post = await this.findOnePostProvider.findOneByIdOrFail(postId)

    // editors can only manage tags on posts they authored
    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException('You can only manage tags on your own posts')
    }

    let newTags: Tag[]
    try {
      newTags = await this.tagsService.findMany(tagIds)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (newTags.length !== tagIds.length) {
      throw new BadRequestException('please check the tag IDs and try again')
    }

    // Only add tags that are not already on the post
    const tagsToAdd = newTags.filter(
      (newTag) => !(post.tags ?? []).some((existing) => existing.id === newTag.id),
    )
    post.tags = [...(post.tags ?? []), ...tagsToAdd]

    try {
      return await this.postsRepository.save(post)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }

  /**
   * Removes the given tags from a post. If a tag is not on the post, it is simply skipped.
   * Editors can only modify posts they created.
   */
  public async removeTags(
    postId: number,
    tagIds: number[],
    activeUser: ActiveUserData,
  ): Promise<Post> {
    const post = await this.findOnePostProvider.findOneByIdOrFail(postId)

    // editors can only manage tags on posts they authored
    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException('You can only manage tags on your own posts')
    }

    const removeSet = new Set(tagIds)
    post.tags = (post.tags ?? []).filter((t) => !removeSet.has(t.id))

    try {
      return await this.postsRepository.save(post)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
