import { Injectable } from '@nestjs/common'
import { UploadFile } from '../entities/upload-file.entity'
import { UploadFileProvider } from './upload-file.provider'
import { DeleteFileProvider } from './delete-file.provider'

/**
 * Orchestrates file uploads: validates the file, delegates storage to
 * `StorageProvider`, then persists the upload metadata.
 */
@Injectable()
export class UploadsService {
  constructor(
    /**
     * inject upload file provider
     */
    private readonly uploadFileProvider: UploadFileProvider,
    /**
     * inject delete file provider
     */
    private readonly deleteFileProvider: DeleteFileProvider,
  ) {}

  /**
   * Validates, uploads, and records a file for the given user under `folder`.
   */
  public async uploadFile(
    file: Express.Multer.File,
    userId: number,
    folder = 'uploads',
    postId?: number,
  ): Promise<UploadFile> {
    return await this.uploadFileProvider.uploadFile(
      file,
      userId,
      folder,
      postId,
    )
  }

  /**
   * Deletes a file from storage and removes its `UploadFile` record from the DB.
   * Looked up by the stored URL (`path` column) so callers only need the URL.
   */
  public async deleteFile(url: string): Promise<void> {
    return await this.deleteFileProvider.deleteFile(url)
  }
}
