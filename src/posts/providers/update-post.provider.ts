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
import { PostStatus } from '../enums/postStatus.enum'
import { TagsService } from 'src/tags/providers/tags.service'
import { FindOnePostProvider } from './find-one-post.provider'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { renderMarkdownToHtml } from 'src/common/utils/render-markdown-to-html.util'

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
    post.slug = patchPostDto.slug ?? post.slug
    // Capture the pre-update status so a transition into PUBLISHED can be
    // detected after assignment — publishedAt is stamped exactly once per
    // transition into PUBLISHED (re-stamps if unpublished and republished later).
    const previousStatus = post.status
    post.status = patchPostDto.status ?? post.status
    if (
      post.status === PostStatus.PUBLISHED &&
      previousStatus !== PostStatus.PUBLISHED
    ) {
      post.publishedAt = new Date()
    }
    // Re-render contentHtml only when content is explicitly sent, not on every
    // save — !== undefined (rather than ??) distinguishes "field omitted" from
    // a resend of the same value.
    if (patchPostDto.content !== undefined) {
      post.content = patchPostDto.content
      post.contentHtml = renderMarkdownToHtml(patchPostDto.content)
    }
    post.excerpt = patchPostDto.excerpt ?? post.excerpt
    post.isFeatured = patchPostDto.isFeatured ?? post.isFeatured
    // featuredImage is nullable and `null` is a valid "clear it" request, so
    // `??` would wrongly discard an explicit null — only `undefined` (field
    // omitted from the request body) should leave the existing value alone.
    if (patchPostDto.featuredImage !== undefined) {
      post.featuredImage = patchPostDto.featuredImage
    }
    // images is nullable/array; only an explicitly-omitted field (undefined)
    // should leave the existing gallery unchanged — null or [] are valid
    // "clear it" / "replace wholesale" requests.
    if (patchPostDto.images !== undefined) {
      post.images = patchPostDto.images
    }
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
