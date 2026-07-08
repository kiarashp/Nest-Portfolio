import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOnePostProvider } from './find-one-post.provider'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeletePostImageProvider {
  private readonly logger = new Logger(DeletePostImageProvider.name)

  constructor(
    /** inject `Post` repository to clear the deleted image from the post */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /** inject `UploadFile` repository to look up the image to delete */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider to verify the post exists and read its author for ownership checks */
    private readonly findOnePostProvider: FindOnePostProvider,
    /** inject uploads service to delete the file from Cloudinary + DB */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record the image removal */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Deletes a single uploaded image from a post: removes it from Cloudinary and
   * the upload_file table, then clears it from the post's featuredImage and/or
   * images gallery if it was referenced there. Lets an editor/author/admin
   * remove a wrong image without deleting the whole post. Editors may only
   * touch posts they authored.
   */
  public async deletePostImage(
    postId: number,
    fileId: number,
    activeUser: ActiveUserData,
  ): Promise<{ deleted: boolean; id: number }> {
    // Throws NotFoundException if the post does not exist (author is eager-loaded).
    const post = await this.findOnePostProvider.findOneByIdOrFail(postId)

    // Editors can only delete images on posts they authored; authors/admins are unrestricted.
    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException(
        'You are not allowed to delete images for this post',
      )
    }

    // The file must exist and belong to this post, else 404.
    const file = await this.uploadFilesRepository.findOneBy({ id: fileId })
    if (!file || file.postId !== postId) {
      throw new NotFoundException(
        `No image with id ${fileId} found for post ${postId}`,
      )
    }

    // Remove from Cloudinary and the upload_file table.
    await this.uploadsService.deleteFile(file.path)

    // Clear the reference from the post so it no longer points at a dead URL.
    // Must be null (not undefined) — TypeORM's save() skips undefined columns,
    // which would leave the stale URL in place. Track whether either field
    // changed so we only save once, covering both at the same time.
    let postChanged = false
    if (post.featuredImage === file.path) {
      post.featuredImage = null
      postChanged = true
    }
    if (post.images?.includes(file.path)) {
      post.images = post.images.filter((url) => url !== file.path)
      postChanged = true
    }
    if (postChanged) {
      await this.postsRepository.save(post)
    }

    this.logger.log(
      `Post image deleted — postId=${postId}, fileId=${fileId}, deletedById=${activeUser.sub}`,
    )
    await this.auditLogService.log(
      activeUser.sub,
      AuditAction.UPDATE,
      'Post',
      postId,
    )
    return { deleted: true, id: fileId }
  }
}
