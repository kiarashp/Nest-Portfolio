import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOneProductProvider } from './find-one-product.provider'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteProductImageProvider {
  private readonly logger = new Logger(DeleteProductImageProvider.name)

  constructor(
    /** inject Product repository to clear the deleted image from the product */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject UploadFile repository to look up the image to delete */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider to verify the product exists */
    private readonly findOneProductProvider: FindOneProductProvider,
    /** inject UploadsService to delete the file from Cloudinary + DB */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record the image removal */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Deletes a single uploaded image from a product: removes it from Cloudinary
   * and the upload_file table, then clears it from the product's imageUrl/images
   * if it was referenced there. Used by admins to swap the featured image or
   * curate the gallery.
   */
  public async deleteImage(
    productId: number,
    fileId: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    const product =
      await this.findOneProductProvider.findOneByIdOrFail(productId)

    // The file must exist and belong to this product, else 404.
    const file = await this.uploadFilesRepository.findOneBy({ id: fileId })
    if (!file || file.productId !== productId) {
      throw new NotFoundException(
        `No image with id ${fileId} found for product ${productId}`,
      )
    }

    // Remove from Cloudinary and the upload_file table.
    await this.uploadsService.deleteFile(file.path)

    // Clear the reference from the product so it no longer points at a dead URL.
    let productChanged = false
    if (product.imageUrl === file.path) {
      product.imageUrl = null
      productChanged = true
    }
    if (product.images?.includes(file.path)) {
      product.images = product.images.filter((url) => url !== file.path)
      productChanged = true
    }
    if (productChanged) {
      await this.productsRepository.save(product)
    }

    this.logger.log(
      `Product image deleted — productId=${productId}, fileId=${fileId}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'Product',
      productId,
    )
    return { deleted: true, id: fileId }
  }
}
