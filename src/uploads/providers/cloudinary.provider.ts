import { Inject, Injectable } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary'
import cloudinaryConfig from 'src/config/cloudinary.config'

/**
 * Talks to the Cloudinary SDK directly. The only class in this module that knows
 * about Cloudinary - everything else just uses the result it returns.
 */
@Injectable()
export class CloudinaryProvider {
  constructor(
    /**
     * inject cloudinary configuration
     */
    @Inject(cloudinaryConfig.KEY)
    private readonly cloudinaryConfiguration: ConfigType<
      typeof cloudinaryConfig
    >,
  ) {
    cloudinary.config({
      cloud_name: this.cloudinaryConfiguration.cloudName,
      api_key: this.cloudinaryConfiguration.apiKey,
      api_secret: this.cloudinaryConfiguration.apiSecret,
    })
  }

  /**
   * Streams the file's in-memory buffer to Cloudinary and resolves with the upload result.
   */
  public uploadImage(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<UploadApiResponse> {
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
          resolve(result)
        },
      )
      uploadStream.end(file.buffer)
    })
  }
}
