import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'
import { CreateProductTypeDto } from '../dto/create-product-type.dto'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateProductTypeProvider {
  private readonly logger = new Logger(CreateProductTypeProvider.name)

  constructor(
    /** inject ProductType repository for persistence */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject audit log service to record type creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new product type. Throws ConflictException if the name or slug
   * is already in use.
   */
  public async create(
    dto: CreateProductTypeDto,
    activeUserId: number,
  ): Promise<ProductType> {
    const productType = this.productTypesRepository.create(dto)
    try {
      const saved = await this.productTypesRepository.save(productType)
      this.logger.log(
        `Product type created — id=${saved.id}, slug=${saved.slug}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.CREATE,
        'ProductType',
        saved.id,
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
