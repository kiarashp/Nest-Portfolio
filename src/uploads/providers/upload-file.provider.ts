import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StorageProvider, UploadResult } from './storage.provider'
import { UploadFile } from '../entities/upload-file.entity'
import { FileType } from '../enums/file-type.enum'

/**
 * Checks the first bytes of a file (its "magic number") against known image
 * signatures, since the request's `Content-Type` header can be faked.
 */
function isSupportedImageBuffer(buffer: Buffer): boolean {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'

  return isJpeg || isPng || isGif || isWebp
}

@Injectable()
export class UploadFileProvider {
  private readonly logger = new Logger(UploadFileProvider.name)

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
   * Validates, uploads, and records a file for the given user under `folder`.
   */
  public async uploadFile(
    file: Express.Multer.File,
    userId: number,
    folder = 'uploads',
    links: { postId?: number; productId?: number } = {},
  ): Promise<UploadFile> {
    // Step 1: make sure the file's actual content is a real image, not just its
    // mimetype header (which the client can set to anything).
    if (!isSupportedImageBuffer(file.buffer)) {
      throw new BadRequestException(
        'The file content does not match a supported image type',
      )
    }

    // Step 2: hand off to the storage backend and get back a provider-agnostic result.
    let uploadResult: UploadResult
    try {
      uploadResult = await this.storageProvider.upload(file, folder)
    } catch (error) {
      this.logger.error(
        `Storage upload failed — folder=${folder}, userId=${userId}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Could not upload the file to storage',
      })
    }

    // Step 3: build the database record from the file and the storage result.
    const newFile = this.filesRepository.create({
      name: file.originalname,
      path: uploadResult.url,
      publicId: uploadResult.publicId,
      type: FileType.IMAGE,
      mime: file.mimetype,
      size: file.size,
      userId,
      postId: links.postId,
      productId: links.productId,
    })

    // Step 4: persist the record so the file can be looked up later.
    try {
      const saved = await this.filesRepository.save(newFile)
      this.logger.log(
        `File uploaded — fileId=${saved.id}, folder=${folder}, userId=${userId}`,
      )
      return saved
    } catch (error) {
      this.logger.error(
        `Failed to persist file record — folder=${folder}, userId=${userId}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Could not persist the file record',
      })
    }
  }
}
