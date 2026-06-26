import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { FindOneProductProvider } from './find-one-product.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteProductProvider {
  private readonly logger = new Logger(DeleteProductProvider.name)

  constructor(
    /** inject Product repository for soft-deletion */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject find-one provider to verify the product exists before deleting */
    private readonly findOneProductProvider: FindOneProductProvider,
    /** inject audit log service to record product soft-deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Soft-deletes a product by setting deletedAt. The row remains in the DB
   * and is excluded from all public queries automatically by TypeORM.
   */
  public async softDelete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    await this.findOneProductProvider.findOneByIdOrFail(id)
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
