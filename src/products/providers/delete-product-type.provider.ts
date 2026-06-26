import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { Product } from '../entities/product.entity'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
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
    /** inject find-one provider for the 404 guard */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
    /** inject audit log service to record type deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Hard-deletes a product type. Throws ConflictException if any product still
   * references this type — callers must reassign or delete those products first.
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
