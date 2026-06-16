import { Injectable } from '@nestjs/common'

export interface UploadResult {
  /** Public URL of the stored file. */
  url: string
  /** Provider-specific unique id needed to delete or transform the asset later. */
  publicId: string
}

/**
 * Abstract storage backend. Inject this token instead of any concrete provider
 * so that swapping Cloudinary for S3 (or any other backend) only requires
 * changing the `useClass` registration in `UploadsModule`.
 */
@Injectable()
export abstract class StorageProvider {
  abstract upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult>

  abstract delete(publicId: string): Promise<void>
}
