import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { StorageProvider } from 'src/uploads/providers/storage.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteConfigurableProductImageProvider {
  private readonly logger = new Logger(
    DeleteConfigurableProductImageProvider.name,
  )

  constructor(
    /** inject ConfigurableProduct repository to clear imageUrl/imagePublicId */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
    /** inject find-one provider to verify the product exists */
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    /** inject StorageProvider to delete the asset directly from the active storage backend */
    private readonly storageProvider: StorageProvider,
    /** inject audit log service to record the image removal */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Clears a configurable product's image: removes it from the storage
   * backend, then clears imageUrl/imagePublicId. Throws NotFoundException if
   * no image is currently tracked.
   */
  public async deleteImage(
    productId: number,
    activeUserId: number,
  ): Promise<ConfigurableProduct> {
    const product =
      await this.findOneConfigurableProductProvider.findOneByIdOrFail(productId)

    if (!product.imagePublicId) {
      throw new NotFoundException('Image not found')
    }

    await this.storageProvider.delete(product.imagePublicId)

    product.imageUrl = null
    product.imagePublicId = null
    const saved = await this.configurableProductsRepository.save(product)

    this.logger.log(
      `Configurable product image deleted — productId=${productId}`,
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
