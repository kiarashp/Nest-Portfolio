import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { SegmentDefinition } from '../entities/segment-definition.entity'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { UpdateSegmentDefinitionDto } from '../dtos/update-segment-definition.dto'
import { FindOneSegmentDefinitionProvider } from './find-one-segment-definition.provider'
import { validateSegmentConstraints } from './validate-segment-constraints.util'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateSegmentDefinitionProvider {
  private readonly logger = new Logger(UpdateSegmentDefinitionProvider.name)

  constructor(
    /** inject SegmentDefinition repository for persistence */
    @InjectRepository(SegmentDefinition)
    private readonly segmentDefinitionsRepository: Repository<SegmentDefinition>,
    /** inject ProductSegmentAssignment repository to guard dataType immutability */
    @InjectRepository(ProductSegmentAssignment)
    private readonly assignmentsRepository: Repository<ProductSegmentAssignment>,
    /** inject find-one provider to load before mutating */
    private readonly findOneSegmentDefinitionProvider: FindOneSegmentDefinitionProvider,
    /** inject audit log service to record definition updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Applies a partial update to a segment definition. A dataType change is
   * rejected with ConflictException once any product assignment references this
   * definition — unreachable via the API until Step 4 ships assignments, but the
   * guard is enforced now so it is correct once assignments exist. Constraints
   * are re-validated whenever dataType or constraints is part of the patch.
   */
  public async update(
    id: number,
    dto: UpdateSegmentDefinitionDto,
    activeUserId: number,
  ): Promise<SegmentDefinition> {
    const definition =
      await this.findOneSegmentDefinitionProvider.findOneByIdOrFail(id)

    if (dto.dataType !== undefined && dto.dataType !== definition.dataType) {
      const assignmentCount = await this.assignmentsRepository.count({
        where: { definitionId: id },
      })
      if (assignmentCount > 0) {
        throw new ConflictException(
          `Cannot change dataType: ${assignmentCount} product assignment(s) already use this definition`,
        )
      }
    }

    if (dto.dataType !== undefined || dto.constraints !== undefined) {
      const effectiveDataType = dto.dataType ?? definition.dataType
      const effectiveConstraints =
        dto.constraints !== undefined ? dto.constraints : definition.constraints
      definition.constraints = validateSegmentConstraints(
        effectiveDataType,
        effectiveConstraints,
      )
    }

    definition.name = dto.name ?? definition.name
    definition.label = dto.label ?? definition.label
    definition.meaningTemplate =
      dto.meaningTemplate ?? definition.meaningTemplate
    if (dto.dataType !== undefined) definition.dataType = dto.dataType

    try {
      const saved = await this.segmentDefinitionsRepository.save(definition)
      this.logger.log(`Segment definition updated — id=${id}`)
      await this.auditLogService.log(
        activeUserId,
        AuditAction.UPDATE,
        'SegmentDefinition',
        id,
      )
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Segment definition name already in use')
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
