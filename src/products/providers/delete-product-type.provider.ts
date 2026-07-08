import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { Product } from '../entities/product.entity'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteProductTypeProvider {
  private readonly logger = new Logger(DeleteProductTypeProvider.name)

  constructor(
    /** inject ProductType repository for deletion */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject Product repository to check for dependent products before deleting */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject UploadFile repository to purge tracked images before deleting */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
    /** inject UploadsService to delete tracked images from Cloudinary + DB */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record type deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Hard-deletes a product type. Throws ConflictException if any product still
   * references this type — callers must reassign or delete those products first.
   * Since this is a hard delete with no soft-delete fallback, any tracked image
   * is purged from Cloudinary + the upload_file table before the row is removed
   * — otherwise the FK on upload_file.productTypeId would block the delete.
   */
  public async delete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    await this.findOneProductTypeProvider.findOneByIdOrFail(id)

    const count = await this.productsRepository.count({
      where: { productTypeId: id },
    })
    if (count > 0) {
      throw new ConflictException(
        `Cannot delete product type: ${count} product(s) still reference it`,
      )
    }

    const images = await this.uploadFilesRepository.find({
      where: { productTypeId: id },
    })
    for (const image of images) {
      await this.uploadsService.deleteFile(image.path)
    }

    await this.productTypesRepository.delete(id)
    this.logger.log(`Product type deleted — id=${id}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.DELETE,
      'ProductType',
      id,
    )
    return { deleted: true, id }
  }
}
