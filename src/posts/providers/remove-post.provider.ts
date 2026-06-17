import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class RemovePostProvider {
  constructor(
    /**
     * inject `Post` repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /**
     * inject uploads service to delete associated images before removing the post
     */
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * Deletes a post and all its associated Cloudinary images.
   */
  public async remove(
    id: number,
    activeUser: ActiveUserData,
  ): Promise<{ deleted: boolean; id: number }> {
    // Step 1: load the post with its images so we know what to clean up.
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: { uploadFiles: true, author: true },
    })
    if (!post) {
      return { deleted: false, id }
    }

    // Step 2: editors can only delete posts they authored.
    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException('You can only delete your own posts')
    }

    // Step 3: delete each image from Cloudinary and the upload_file table.
    if (post.uploadFiles?.length) {
      for (const uploadFile of post.uploadFiles) {
        await this.uploadsService.deleteFile(uploadFile.path)
      }
    }

    // Step 4: delete the post row.
    await this.postsRepository.delete(post.id)

    return { deleted: true, id }
  }
}
