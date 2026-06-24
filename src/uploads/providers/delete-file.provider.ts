import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StorageProvider } from './storage.provider'
import { UploadFile } from '../entities/upload-file.entity'

@Injectable()
export class DeleteFileProvider {
  private readonly logger = new Logger(DeleteFileProvider.name)

  constructor(
    /**
     * inject the active storage backend (currently Cloudinary, see UploadsModule)
     */
    private readonly storageProvider: StorageProvider,
    /**
     * inject `UploadFile` repository
     */
    @InjectRepository(UploadFile)
    private readonly filesRepository: Repository<UploadFile>,
  ) {}

  /**
   * Deletes a file from storage and removes its `UploadFile` record from the DB.
   * Looked up by the stored URL (`path` column) so callers only need the URL.
   */
  public async deleteFile(url: string): Promise<void> {
    const uploadFile = await this.filesRepository.findOneBy({ path: url })
    if (!uploadFile) {
      this.logger.warn(`Delete attempted for unknown file — url=${url}`)
      throw new NotFoundException(`No upload record found for url: ${url}`)
    }

    try {
      await this.storageProvider.delete(uploadFile.publicId)
    } catch (error) {
      this.logger.error(
        `Storage delete failed — publicId=${uploadFile.publicId}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Could not delete the file from storage',
      })
    }

    await this.filesRepository.remove(uploadFile)
    this.logger.log(
      `File deleted — fileId=${uploadFile.id}, publicId=${uploadFile.publicId}`,
    )
  }
}
