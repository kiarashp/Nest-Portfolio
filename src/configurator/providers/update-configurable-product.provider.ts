import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { UpdateConfigurableProductDto } from '../dtos/update-configurable-product.dto'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateConfigurableProductProvider {
  private readonly logger = new Logger(UpdateConfigurableProductProvider.name)

  constructor(
    /** inject ConfigurableProduct repository for persistence */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
    /** inject find-one provider to load before mutating */
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    /** inject audit log service to record product updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Applies a partial update to a configurable product. Uses !== undefined
   * (not ??) so a client can explicitly clear the nullable description by
   * sending null. imageUrl/imagePublicId are not part of this DTO — they are
   * only ever changed via the dedicated image upload/delete endpoints.
   */
  public async update(
    id: number,
    dto: UpdateConfigurableProductDto,
    activeUserId: number,
  ): Promise<ConfigurableProduct> {
    const product =
      await this.findOneConfigurableProductProvider.findOneByIdOrFail(id)

    if (dto.name !== undefined) product.name = dto.name
    if (dto.slug !== undefined) product.slug = dto.slug
    if (dto.codePrefix !== undefined) product.codePrefix = dto.codePrefix
    if (dto.description !== undefined) product.description = dto.description
    if (dto.isPublished !== undefined) product.isPublished = dto.isPublished

    try {
      const saved = await this.configurableProductsRepository.save(product)
      this.logger.log(`Configurable product updated — id=${id}`)
      await this.auditLogService.log(
        activeUserId,
        AuditAction.UPDATE,
        'ConfigurableProduct',
        id,
      )
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'Configurable product name or slug already in use',
        )
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
