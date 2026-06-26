import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { UpdateProductTypeDto } from '../dto/update-product-type.dto'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateProductTypeProvider {
  private readonly logger = new Logger(UpdateProductTypeProvider.name)

  constructor(
    /** inject ProductType repository for persistence */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject find-one provider to load before mutating */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
    /** inject audit log service to record type updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Applies a partial update to a product type. Throws NotFoundException if
   * the type does not exist, ConflictException if the new name or slug
   * collides with an existing type.
   */
  public async update(
    id: number,
    dto: UpdateProductTypeDto,
    activeUserId: number,
  ): Promise<ProductType> {
    const productType =
      await this.findOneProductTypeProvider.findOneByIdOrFail(id)

    productType.name = dto.name ?? productType.name
    productType.slug = dto.slug ?? productType.slug
    if (dto.filterableFields !== undefined) {
      productType.filterableFields = dto.filterableFields
    }

    try {
      const saved = await this.productTypesRepository.save(productType)
      this.logger.log(`Product type updated — id=${id}`)
      await this.auditLogService.log(
        activeUserId,
        AuditAction.UPDATE,
        'ProductType',
        id,
      )
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Product type name or slug already in use')
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
