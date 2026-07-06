import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOnePostProvider } from './find-one-post.provider'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class FindPostImagesProvider {
  constructor(
    /**
     * inject UploadFile repository to query images linked to a post
     */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /**
     * inject FindOnePostProvider to verify the post exists and read the author for ownership checks
     */
    private readonly findOnePostProvider: FindOnePostProvider,
  ) {}

  /**
   * Returns all images that were uploaded for the given post.
   * Editors can only see images on posts they authored; authors and admins are unrestricted.
   */
  public async findPostImages(
    postId: number,
    activeUser: ActiveUserData,
  ): Promise<UploadFile[]> {
    // Throws NotFoundException if the post does not exist.
    const post = await this.findOnePostProvider.findOneByIdOrFail(postId)

    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException(
        'You are not allowed to view images for this post',
      )
    }

    return await this.uploadFilesRepository.find({ where: { postId } })
  }

  /**
   * Returns a single image uploaded for the given post. Editors can only view
   * images on posts they authored; authors and admins are unrestricted.
   * Throws NotFoundException if the post doesn't exist or the file is not
   * linked to that post.
   */
  public async findPostImage(
    postId: number,
    fileId: number,
    activeUser: ActiveUserData,
  ): Promise<UploadFile> {
    const post = await this.findOnePostProvider.findOneByIdOrFail(postId)

    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException(
        'You are not allowed to view images for this post',
      )
    }

    const file = await this.uploadFilesRepository.findOne({
      where: { id: fileId, postId },
    })
    if (!file) throw new NotFoundException('Image not found')
    return file
  }
}
