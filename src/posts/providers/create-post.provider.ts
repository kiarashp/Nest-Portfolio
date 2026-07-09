import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { CreatePostDto } from '../dto/create-post.dto'
import { UsersService } from 'src/users/providers/users.service'
import { TagsService } from 'src/tags/providers/tags.service'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Post } from '../entities/post.entity'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { Tag } from 'src/tags/entities/tag.entity'
import { User } from 'src/users/entities/user.entity'
import { PostStatus } from '../enums/postStatus.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { renderMarkdownToHtml } from 'src/common/utils/render-markdown-to-html.util'

@Injectable()
export class CreatePostProvider {
  private readonly logger = new Logger(CreatePostProvider.name)

  constructor(
    /**
     * inject user service
     */
    private readonly usersService: UsersService,
    /**
     * inject tag service
     */
    private readonly tagsService: TagsService,
    /**
     * inject post repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /** inject audit log service to record post creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * create a new post
   */
  public async create(
    createPostDto: CreatePostDto,
    activeUser: ActiveUserData,
  ) {
    let author: User | null = null
    let tags: Tag[] | null = null
    try {
      //find author
      author = await this.usersService.findOneById(activeUser.sub)
      //find tags
      tags = await this.tagsService.findMany(createPostDto.tags)
    } catch (error) {
      throw new ConflictException(error)
    }
    // How many tag IDs the caller sent (0 when the field is absent).
    const requestedCount = createPostDto.tags?.length ?? 0
    // How many of those IDs actually exist in the DB.
    const foundCount = tags?.length ?? 0
    // If the numbers differ, at least one ID was invalid — reject early.
    if (requestedCount !== foundCount)
      throw new BadRequestException('please check the tags ID and try again')

    // Fill in defaults for optional fields so a draft can be created with minimal input.
    const title = createPostDto.title ?? 'Untitled'
    const slug = createPostDto.slug ?? `draft-${randomUUID()}`
    const status = createPostDto.status ?? PostStatus.DRAFT
    // publishedAt is stamped here too so a post created directly with
    // status: PUBLISHED doesn't skip the "publishedAt set exactly when
    // status is/became PUBLISHED" invariant that UpdatePostProvider enforces.
    const publishedAt = status === PostStatus.PUBLISHED ? new Date() : undefined
    const contentHtml = createPostDto.content
      ? renderMarkdownToHtml(createPostDto.content)
      : undefined

    //create post
    const post = this.postsRepository.create({
      ...createPostDto,
      title,
      slug,
      status,
      publishedAt,
      contentHtml,
      isFeatured: createPostDto.isFeatured ?? false,
      author: author,
      tags: tags,
    })
    try {
      const saved = await this.postsRepository.save(post)
      this.logger.log(
        `Post created — postId=${saved.id}, authorId=${activeUser.sub}, status=${saved.status}`,
      )
      await this.auditLogService.log(
        activeUser.sub,
        AuditAction.CREATE,
        'Post',
        saved.id,
      )
      return saved
    } catch (error) {
      this.logger.error(
        `Failed to create post — authorId=${activeUser.sub}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Ensure that the post slug is unique',
      })
    }
  }
}
