import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { DataSource, QueryFailedError } from 'typeorm'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { CreateAssignmentDto } from '../dtos/create-assignment.dto'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { FindOneSegmentDefinitionProvider } from './find-one-segment-definition.provider'
import { validateAssignmentCondition } from './validate-assignment-condition.util'
import { validateAssignmentConditionRules } from './validate-assignment-condition-rules.util'
import { shiftPositionsUpFrom } from './renumber-assignments.util'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateAssignmentProvider {
  private readonly logger = new Logger(CreateAssignmentProvider.name)

  constructor(
    /** inject DataSource to run the position-shift + insert inside a transaction */
    private readonly dataSource: DataSource,
    /** inject find-one provider to load the parent product and its existing assignments */
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    /** inject find-one provider to load the definition being assigned */
    private readonly findOneSegmentDefinitionProvider: FindOneSegmentDefinitionProvider,
    /** inject audit log service to record assignment creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Places a SegmentDefinition at a position inside a ConfigurableProduct.
   * Defaults to appending after the last existing assignment when no position
   * is given; an explicit position shifts every assignment at or after it up
   * by one, inside a transaction, to keep positions gapless. A SELECT
   * definition needs at least 2 options before it can be assigned. An optional
   * condition is shape- and rule-validated against the product's existing
   * assignments before anything is written.
   */
  public async create(
    productId: number,
    dto: CreateAssignmentDto,
    activeUserId: number,
  ): Promise<ProductSegmentAssignment> {
    const product =
      await this.findOneConfigurableProductProvider.findOneByIdOrFail(productId)
    const definition =
      await this.findOneSegmentDefinitionProvider.findOneByIdOrFail(
        dto.definitionId,
      )
    const siblings = product.assignments ?? []

    if (
      definition.dataType === SegmentDataType.SELECT &&
      (definition.options?.length ?? 0) < 2
    ) {
      throw new BadRequestException(
        'SELECT definitions need at least 2 options before they can be assigned to a product',
      )
    }

    const finalPosition = dto.position ?? siblings.length + 1
    if (
      dto.position !== undefined &&
      (dto.position < 1 || dto.position > siblings.length + 1)
    ) {
      throw new BadRequestException(
        `position must be between 1 and ${siblings.length + 1}`,
      )
    }

    const condition =
      dto.condition !== undefined && dto.condition !== null
        ? validateAssignmentCondition(dto.condition)
        : null
    if (condition) {
      validateAssignmentConditionRules({
        condition,
        ownDefinition: definition,
        ownFinalPosition: finalPosition,
        siblings,
      })
    }

    const queryRunner = this.dataSource.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }

    let saved: ProductSegmentAssignment
    try {
      if (finalPosition <= siblings.length) {
        await shiftPositionsUpFrom(
          queryRunner.manager,
          productId,
          finalPosition,
        )
      }
      const assignment = queryRunner.manager.create(ProductSegmentAssignment, {
        productId,
        definitionId: dto.definitionId,
        position: finalPosition,
        condition,
      })
      saved = await queryRunner.manager.save(assignment)
      await queryRunner.commitTransaction()
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction()
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'This definition is already assigned to this product',
        )
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    } finally {
      await queryRunner.release()
    }

    this.logger.log(
      `Assignment created — id=${saved.id}, productId=${productId}, position=${finalPosition}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.CREATE,
      'ProductSegmentAssignment',
      saved.id,
    )
    return saved
  }
}
