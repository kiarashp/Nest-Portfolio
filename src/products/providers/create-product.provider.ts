import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { CreateProductDto } from '../dto/create-product.dto'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateProductProvider {
  private readonly logger = new Logger(CreateProductProvider.name)

  constructor(
    /** inject Product repository for persistence */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject audit log service to record product creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new product. The product starts unpublished by default unless
   * the caller explicitly sets isPublished to true. Throws ConflictException
   * on duplicate slug or SKU, BadRequestException on invalid productTypeId.
   */
  public async create(
    dto: CreateProductDto,
    activeUserId: number,
  ): Promise<Product> {
    const product = this.productsRepository.create({
      ...dto,
      isPublished: dto.isPublished ?? false,
    })

    try {
      const saved = await this.productsRepository.save(product)
      this.logger.log(
        `Product created — id=${saved.id}, slug=${saved.slug}, typeId=${saved.productTypeId}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.CREATE,
        'Product',
        saved.id,
      )
      return saved
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string })?.code
        if (code === '23505') {
          throw new ConflictException(
            'A product with this slug or SKU already exists',
          )
        }
        if (code === '23503') {
          // FK violation — the productTypeId does not reference an existing type
          throw new BadRequestException(
            `Product type with id ${dto.productTypeId} does not exist`,
          )
        }
      }
      this.logger.error(
        `Failed to create product — slug=${dto.slug}`,
        (error as Error).stack,
      )
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
