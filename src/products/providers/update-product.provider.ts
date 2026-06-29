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
import { ProductType } from '../entities/product-type.entity'
import { UpdateProductDto } from '../dto/update-product.dto'
import { FindOneProductProvider } from './find-one-product.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { validateSpecsAgainstType } from './validate-specs.util'

@Injectable()
export class UpdateProductProvider {
  private readonly logger = new Logger(UpdateProductProvider.name)

  constructor(
    /** inject Product repository for persistence */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    /** inject ProductType repository to validate specs against filterableFields */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneProductProvider: FindOneProductProvider,
    /** inject audit log service to record product updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Applies a partial update to a product. Non-undefined fields in the DTO
   * overwrite the stored values — including nullable fields, so callers can
   * explicitly clear a field by sending null.
   */
  public async update(
    id: number,
    dto: UpdateProductDto,
    activeUserId: number,
  ): Promise<Product> {
    const product = await this.findOneProductProvider.findOneByIdOrFail(id)

    // Use !== undefined (not ??) so that a client can clear nullable fields
    // by explicitly sending null — nullish coalescing would silently skip them.
    if (dto.name !== undefined) product.name = dto.name
    if (dto.slug !== undefined) product.slug = dto.slug
    if (dto.sku !== undefined) product.sku = dto.sku
    if (dto.shortDescription !== undefined)
      product.shortDescription = dto.shortDescription
    if (dto.description !== undefined) product.description = dto.description
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl
    if (dto.images !== undefined) product.images = dto.images
    if (dto.specs !== undefined) product.specs = dto.specs
    if (dto.isPublished !== undefined) product.isPublished = dto.isPublished
    if (dto.productTypeId !== undefined)
      product.productTypeId = dto.productTypeId

    // Re-validate specs whenever the specs or the type changes, so the stored
    // values stay aligned with the (possibly new) type's filterableFields.
    if (
      (dto.specs !== undefined || dto.productTypeId !== undefined) &&
      product.specs &&
      Object.keys(product.specs).length > 0
    ) {
      const type = await this.productTypesRepository.findOneBy({
        id: product.productTypeId,
      })
      if (!type) {
        throw new BadRequestException(
          `Product type with id ${product.productTypeId} does not exist`,
        )
      }
      validateSpecsAgainstType(product.specs, type.filterableFields)
    }

    try {
      const saved = await this.productsRepository.save(product)
      this.logger.log(`Product updated — id=${id}`)
      await this.auditLogService.log(
        activeUserId,
        AuditAction.UPDATE,
        'Product',
        id,
      )
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'A product with this slug or SKU already exists',
        )
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
