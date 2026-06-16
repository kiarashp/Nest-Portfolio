import { Inject, Injectable } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { v2 as cloudinary } from 'cloudinary'
import cloudinaryConfig from 'src/config/cloudinary.config'
import { StorageProvider, UploadResult } from './storage.provider'

/**
 * Cloudinary implementation of `StorageProvider`.
 * The only class in this module that touches the Cloudinary SDK — swap this
 * class out (and update `useClass` in `UploadsModule`) to change storage backends.
 */
@Injectable()
export class CloudinaryProvider extends StorageProvider {
  constructor(
    /**
     * inject cloudinary configuration
     */
    @Inject(cloudinaryConfig.KEY)
    private readonly cloudinaryConfiguration: ConfigType<
      typeof cloudinaryConfig
    >,
  ) {
    super()
    cloudinary.config({
      cloud_name: this.cloudinaryConfiguration.cloudName,
      api_key: this.cloudinaryConfiguration.apiKey,
      api_secret: this.cloudinaryConfiguration.apiSecret,
    })
  }

  /**
   * Streams the file's in-memory buffer to Cloudinary and resolves with the
   * generic `UploadResult` shape (no Cloudinary types leak past this class).
   */
  public upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', folder },
        (error, result) => {
          if (error || !result) {
            return reject(
              error instanceof Error
                ? error
                : new Error(error?.message ?? 'Cloudinary upload failed'),
            )
          }
          resolve({ url: result.secure_url, publicId: result.public_id })
        },
      )
      uploadStream.end(file.buffer)
    })
  }

  /**
   * Deletes an asset from Cloudinary by its public id.
   */
  public async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId)
  }
}