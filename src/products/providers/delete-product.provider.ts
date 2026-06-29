import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOneProductProvider } from './find-one-product.provider'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteProductProvider {
  private readonly logger = new Logger(DeleteProductProvider.name)

  constructor(
    /** inject Product repository for soft-deletion */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject UploadFile repository to find images to clean up before deletion */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider to verify the product exists before deleting */
    private readonly findOneProductProvider: FindOneProductProvider,
    /** inject UploadsService to delete each image from Cloudinary + DB */
    private readonly uploadsService: UploadsService,
    /** inject audit log service to record product soft-deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Soft-deletes a product by setting deletedAt. The row remains in the DB
   * and is excluded from all public queries automatically by TypeORM. Before
   * soft-deleting, every uploaded image for the product is purged from
   * Cloudinary and the upload_file table — there is no restore endpoint, so the
   * assets are safe to remove permanently.
   */
  public async softDelete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    await this.findOneProductProvider.findOneByIdOrFail(id)

    // Delete each Cloudinary asset (and its upload_file row) tied to this product.
    const images = await this.uploadFilesRepository.find({
      where: { productId: id },
    })
    for (const image of images) {
      await this.uploadsService.deleteFile(image.path)
    }

    await this.productsRepository.softDelete(id)
    this.logger.log(`Product soft-deleted — id=${id}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.SOFT_DELETE,
      'Product',
      id,
    )
    return { deleted: true, id }
  }
}
