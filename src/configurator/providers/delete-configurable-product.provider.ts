import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteConfigurableProductProvider {
  private readonly logger = new Logger(DeleteConfigurableProductProvider.name)

  constructor(
    /** inject ConfigurableProduct repository for soft-deletion */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    /** inject audit log service to record product deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Soft-deletes a configurable product by setting deletedAt. Unlike Product,
   * the Cloudinary image is deliberately kept, not purged — CONFIGURATOR.md
   * §2.1/§7 state this explicitly, and there is no restore endpoint for either
   * entity, so this is a considered choice, not an oversight.
   */
  public async delete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    await this.findOneConfigurableProductProvider.findOneByIdOrFail(id)

    await this.configurableProductsRepository.softDelete(id)
    this.logger.log(`Configurable product soft-deleted — id=${id}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.SOFT_DELETE,
      'ConfigurableProduct',
      id,
    )
    return { deleted: true, id }
  }
}
