import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { FindOnePostProvider } from './find-one-post.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class UploadPostImageProvider {
  private readonly logger = new Logger(UploadPostImageProvider.name)

  constructor(
    /**
     * inject `FindOnePostProvider` to look up the post and verify ownership
     */
    private readonly findOnePostProvider: FindOnePostProvider,
    /**
     * inject `UploadsService` to handle validation, upload, and UploadFile persistence
     */
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * Uploads an image for a post and stores it with the postId so it can be
   * cleaned up when the post is deleted. Returns the UploadFile record so
   * the caller has the URL and can use it however they like (e.g. set as featuredImage).
   */
  public async uploadPostImage(
    file: Express.Multer.File,
    postId: number,
    activeUser: ActiveUserData,
  ): Promise<UploadFile> {
    // Step 1: make sure the post exists.
    const post = await this.findOnePostProvider.findOneByIdOrFail(postId)

    // Step 2: editors can only upload to posts they authored; authors/admins can upload to any.
    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException(
        'You are not allowed to upload images to this post',
      )
    }

    // Step 3: upload and persist the file, linked to this post.
    const result = await this.uploadsService.uploadFile(
      file,
      activeUser.sub,
      `posts/${postId}`,
      postId,
    )
    this.logger.log(
      `Image uploaded for post — postId=${postId}, fileId=${result.id}, uploaderId=${activeUser.sub}`,
    )
    return result
  }
}
