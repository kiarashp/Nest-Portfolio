import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { User } from '../entities/user.entity'

@Injectable()
export class UploadAvatarProvider {
  constructor(
    /**
     * inject `UploadsService` to handle validation, upload, and UploadFile persistence
     */
    private readonly uploadsService: UploadsService,
    /**
     * inject `User` repository to update avatarUrl on the user record
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Uploads the file to storage under `users/<userId>/`, deletes any previously
   * stored avatar, then updates the user's `avatarUrl` with the new URL.
   */
  public async uploadAvatar(
    file: Express.Multer.File,
    userId: number,
  ): Promise<User> {
    // Step 1: find the user so we know if there is an existing avatar to remove.
    const user = await this.usersRepository.findOneBy({ id: userId })
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`)
    }

    // Step 2: if the user already has an avatar, delete it from storage and the DB.
    const currentAvatarUrl = user.avatarUrl
    if (currentAvatarUrl) {
      await this.uploadsService.deleteFile(currentAvatarUrl)
    }

    // Step 3: upload the new file and persist the UploadFile record.
    const uploadFile = await this.uploadsService.uploadFile(
      file,
      userId,
      `users/${userId}`,
    )

    // Step 4: stamp the new URL onto the user record.
    try {
      user.avatarUrl = uploadFile.path
      return await this.usersRepository.save(user)
    } catch (error) {
      throw new ConflictException(error, {
        description: 'Could not update the user avatar',
      })
    }
  }
}
