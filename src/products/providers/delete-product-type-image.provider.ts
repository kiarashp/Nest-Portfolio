import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteProductTypeImageProvider {
  private readonly logger = new Logger(DeleteProductTypeImageProvider.name)

  constructor(
    /** inject ProductType repository to clear imageUrl once the file is gone */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject UploadFile repository to look up the tracked image */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider to verify the product type exists */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
    /** inject UploadsService to delete the file from Cloudinary + DB */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record the image removal */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Clears the product type's image: removes it from Cloudinary and the
   * upload_file table, then clears imageUrl if it still pointed at the deleted
   * file (a direct PATCH could have since pointed it elsewhere).
   */
  public async deleteImage(
    productTypeId: number,
    activeUserId: number,
  ): Promise<ProductType> {
    const productType =
      await this.findOneProductTypeProvider.findOneByIdOrFail(productTypeId)

    const file = await this.uploadFilesRepository.findOne({
      where: { productTypeId },
    })
    if (!file) throw new NotFoundException('Image not found')

    await this.uploadsService.deleteFile(file.path)

    if (productType.imageUrl === file.path) {
      productType.imageUrl = null
      await this.productTypesRepository.save(productType)
    }

    this.logger.log(
      `Product type image deleted — productTypeId=${productTypeId}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'ProductType',
      productTypeId,
    )
    return productType
  }
}
