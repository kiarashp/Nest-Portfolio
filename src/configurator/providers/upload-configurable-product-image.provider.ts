import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { StorageProvider } from 'src/uploads/providers/storage.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UploadConfigurableProductImageProvider {
  private readonly logger = new Logger(
    UploadConfigurableProductImageProvider.name,
  )

  constructor(
    /** inject ConfigurableProduct repository to persist the new imageUrl/imagePublicId */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    /** inject StorageProvider to upload/replace the Cloudinary asset directly — this
     * entity has no UploadFile row, mirroring the avatar-options pattern */
    private readonly storageProvider: StorageProvider,
    /** inject audit log service to record the image change */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Uploads an image for a configurable product and sets imageUrl/imagePublicId
   * in the same call — a product has only one image slot. Any previously
   * tracked asset is destroyed from Cloudinary first so replacing the image
   * never leaves an orphan behind.
   */
  public async upload(
    file: Express.Multer.File,
    productId: number,
    activeUserId: number,
  ): Promise<ConfigurableProduct> {
    const product =
      await this.findOneConfigurableProductProvider.findOneByIdOrFail(productId)

    if (product.imagePublicId) {
      await this.storageProvider.delete(product.imagePublicId)
    }

    const { url, publicId } = await this.storageProvider.upload(
      file,
      `configurator-products/${productId}`,
    )

    product.imageUrl = url
    product.imagePublicId = publicId
    const saved = await this.configurableProductsRepository.save(product)

    this.logger.log(
      `Configurable product image uploaded — productId=${productId}, publicId=${publicId}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'ConfigurableProduct',
      productId,
    )
    return saved
  }
}
