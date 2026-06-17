import { Injectable } from '@nestjs/common'

export interface UploadResult {
  /** Public URL of the stored file. */
  url: string
  /** Provider-specific unique id needed to delete or transform the asset later. */
  publicId: string
}

/**
 * Abstract storage backend. We use an abstract class instead of an interface
 * because NestJS needs something that exists at runtime to wire up dependencies
 * — interfaces disappear after compilation, abstract classes don't.
 *
 * The actual implementation (currently `CloudinaryProvider`) is swapped in via
 * `useClass` in `UploadsModule`, so nothing that injects this ever needs to
 * know which storage backend is actually running.
 */
@Injectable()
export abstract class StorageProvider {
  abstract upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult>

  abstract delete(publicId: string): Promise<void>
}
