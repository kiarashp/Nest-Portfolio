import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StorageProvider } from 'src/uploads/providers/storage.provider'
import { AvatarOption } from '../entities/avatar-option.entity'

@Injectable()
export class AvatarOptionsProvider {
  constructor(
    /**
     * Inject the AvatarOption repository for DB reads and writes
     */
    @InjectRepository(AvatarOption)
    private readonly avatarOptionRepo: Repository<AvatarOption>,

    /**
     * Inject StorageProvider to upload images to Cloudinary and delete them on removal
     */
    private readonly storageProvider: StorageProvider,
  ) {}

  /**
   * Returns all avatar options ordered by id ascending.
   */
  public async findAll(): Promise<AvatarOption[]> {
    return this.avatarOptionRepo.find({ order: { id: 'ASC' } })
  }

  /**
   * Uploads the file to Cloudinary, then saves the url and publicId to the DB.
   */
  public async create(file: Express.Multer.File): Promise<AvatarOption> {
    const { url, publicId } = await this.storageProvider.upload(file, 'avatars')
    try {
      return await this.avatarOptionRepo.save({ url, publicId })
    } catch {
      throw new BadRequestException('Could not save avatar option')
    }
  }

  /**
   * Deletes the Cloudinary asset and removes the DB row.
   * Throws NotFoundException if no option with that id exists.
   */
  public async remove(id: number): Promise<{ message: string }> {
    const option = await this.avatarOptionRepo.findOne({ where: { id } })
    if (!option) throw new NotFoundException('Avatar option not found')

    await this.storageProvider.delete(option.publicId)
    await this.avatarOptionRepo.delete(id)

    return { message: 'Avatar option removed' }
  }
}
