import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UploadProductTypeImageProvider {
  private readonly logger = new Logger(UploadProductTypeImageProvider.name)

  constructor(
    /** inject ProductType repository to persist the new imageUrl */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject UploadFile repository to find any previously tracked image */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
    /** inject UploadsService to validate, upload, and persist the UploadFile row */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record the image change */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Uploads an image for a product type and, unlike products/posts, sets
   * imageUrl in the same call — a type has only one image slot, so there is no
   * separate gallery to manage. Any previously tracked image is purged from
   * Cloudinary and the upload_file table first so replacing the image never
   * leaves an orphaned asset behind.
   */
  public async upload(
    file: Express.Multer.File,
    productTypeId: number,
    activeUserId: number,
  ): Promise<ProductType> {
    const productType =
      await this.findOneProductTypeProvider.findOneByIdOrFail(productTypeId)

    const existing = await this.uploadFilesRepository.findOne({
      where: { productTypeId },
    })
    if (existing) {
      await this.uploadsService.deleteFile(existing.path)
    }

    const result = await this.uploadsService.uploadFile(
      file,
      activeUserId,
      `product-types/${productTypeId}`,
      { productTypeId },
    )

    productType.imageUrl = result.path
    await this.productTypesRepository.save(productType)

    this.logger.log(
      `Product type image uploaded — productTypeId=${productTypeId}, fileId=${result.id}, url=${result.path}`,
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
