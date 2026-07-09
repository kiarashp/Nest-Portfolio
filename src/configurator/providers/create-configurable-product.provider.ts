import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { CreateConfigurableProductDto } from '../dtos/create-configurable-product.dto'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateConfigurableProductProvider {
  private readonly logger = new Logger(CreateConfigurableProductProvider.name)

  constructor(
    /** inject ConfigurableProduct repository for persistence */
    @InjectRepository(ConfigurableProduct)
    private readonly configurableProductsRepository: Repository<ConfigurableProduct>,
    /** inject audit log service to record product creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new configurable product. Throws ConflictException if the name
   * or slug is already in use.
   */
  public async create(
    dto: CreateConfigurableProductDto,
    activeUserId: number,
  ): Promise<ConfigurableProduct> {
    const product = this.configurableProductsRepository.create({
      ...dto,
      isPublished: dto.isPublished ?? false,
    })

    try {
      const saved = await this.configurableProductsRepository.save(product)
      this.logger.log(
        `Configurable product created — id=${saved.id}, slug=${saved.slug}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.CREATE,
        'ConfigurableProduct',
        saved.id,
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
