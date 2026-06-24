import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { PatchPostDto } from '../dto/update-post.dto'
import { TagsService } from 'src/tags/providers/tags.service'
import { FindOnePostProvider } from './find-one-post.provider'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdatePostProvider {
  private readonly logger = new Logger(UpdatePostProvider.name)

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
    /** inject audit log service to record post updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Updates a post's fields and optionally its tags.
   */
  public async update(
    id: number,
    patchPostDto: PatchPostDto,
    activeUser: ActiveUserData,
  ): Promise<Post> {
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

    // Step 3: editors can only update posts they authored.
    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException('You can only edit your own posts')
    }

    // Step 4: apply the updates.
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

    // Step 5: persist.
    try {
      const saved = await this.postsRepository.save(post)
      this.logger.log(
        `Post updated — postId=${id}, status=${saved.status}, editorId=${activeUser.sub}`,
      )
      await this.auditLogService.log(
        activeUser.sub,
        AuditAction.UPDATE,
        'Post',
        id,
      )
      return saved
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
