import { Injectable, Logger } from '@nestjs/common'
import { FindOneProductProvider } from './find-one-product.provider'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UploadProductImageProvider {
  private readonly logger = new Logger(UploadProductImageProvider.name)

  constructor(
    /** inject find-one provider for the 404 guard */
    private readonly findOneProductProvider: FindOneProductProvider,
    /** inject UploadsService to validate, upload, and persist the UploadFile row */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record the image upload */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Uploads an image for a product and stores it as an UploadFile row linked by
   * productId, so it can be cleaned up from Cloudinary when the product is
   * deleted. Returns the UploadFile record (with its URL) — the caller then sets
   * imageUrl/images on the product via the normal update endpoint (decoupled,
   * same model as post images).
   */
  public async upload(
    file: Express.Multer.File,
    productId: number,
    activeUserId: number,
  ): Promise<UploadFile> {
    // Make sure the product exists (admins may upload to drafts too).
    await this.findOneProductProvider.findOneByIdOrFail(productId)

    // Upload and persist the file, linked to this product.
    const result = await this.uploadsService.uploadFile(
      file,
      activeUserId,
      `products/${productId}`,
      { productId },
    )
    this.logger.log(
      `Product image uploaded — productId=${productId}, fileId=${result.id}, url=${result.path}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'Product',
      productId,
    )
    return result
  }
}
