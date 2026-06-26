import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { FindOneProductProvider } from './find-one-product.provider'
import { StorageProvider } from 'src/uploads/providers/storage.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UploadProductImageProvider {
  private readonly logger = new Logger(UploadProductImageProvider.name)

  constructor(
    /** inject Product repository to persist the updated imageUrl */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneProductProvider: FindOneProductProvider,
    /** inject StorageProvider to upload the file to Cloudinary */
    private readonly storageProvider: StorageProvider,
    /** inject audit log service to record the image update */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Uploads the file to Cloudinary, sets product.imageUrl to the returned URL,
   * and saves the product. Returns the updated product. No UploadFile row is
   * created — the URL is stored directly on the product (same pattern as avatar options).
   */
  public async upload(
    file: Express.Multer.File,
    productId: number,
    activeUserId: number,
  ): Promise<Product> {
    const product =
      await this.findOneProductProvider.findOneByIdOrFail(productId)

    const { url } = await this.storageProvider.upload(file, 'products')
    product.imageUrl = url

    const saved = await this.productsRepository.save(product)
    this.logger.log(
      `Product image uploaded — productId=${productId}, url=${url}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'Product',
      productId,
    )
    return saved
  }
}
