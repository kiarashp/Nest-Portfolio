import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, QueryFailedError, Repository } from 'typeorm'
import {
  AssignmentCondition,
  ProductSegmentAssignment,
} from '../entities/product-segment-assignment.entity'
import { UpdateAssignmentDto } from '../dtos/update-assignment.dto'
import { FindOneAssignmentProvider } from './find-one-assignment.provider'
import { validateAssignmentCondition } from './validate-assignment-condition.util'
import { validateAssignmentConditionRules } from './validate-assignment-condition-rules.util'
import {
  moveAssignmentPosition,
  shiftedPosition,
} from './renumber-assignments.util'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateAssignmentProvider {
  private readonly logger = new Logger(UpdateAssignmentProvider.name)

  constructor(
    /** inject ProductSegmentAssignment repository for the no-reorder write path */
    @InjectRepository(ProductSegmentAssignment)
    private readonly assignmentsRepository: Repository<ProductSegmentAssignment>,
    /** inject DataSource to run a reorder's position shift inside a transaction */
    private readonly dataSource: DataSource,
    /** inject find-one provider to load the assignment and its product siblings */
    private readonly findOneAssignmentProvider: FindOneAssignmentProvider,
    /** inject audit log service to record assignment updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Applies a partial update to an assignment: position (reorders siblings,
   * gapless), condition (send null to clear, omit to leave unchanged), or
   * both. A position change is re-validated against every direction rule a
   * uniform shift could possibly break — this assignment's own condition (if
   * any) must still point at a strictly lower position, and every other
   * assignment that targets this one as its controller must still end up at a
   * strictly higher position. The former is an input-validity failure (400);
   * the latter is a conflict with existing sibling state (409).
   */
  public async update(
    assignmentId: number,
    dto: UpdateAssignmentDto,
    activeUserId: number,
  ): Promise<ProductSegmentAssignment> {
    const assignment =
      await this.findOneAssignmentProvider.findOneByIdOrFail(assignmentId)
    const siblings = assignment.product.assignments ?? []
    const otherSiblings = siblings.filter((s) => s.id !== assignmentId)

    const newPosition = dto.position ?? assignment.position
    if (
      dto.position !== undefined &&
      (dto.position < 1 || dto.position > siblings.length)
    ) {
      throw new BadRequestException(
        `position must be between 1 and ${siblings.length}`,
      )
    }

    let newCondition: AssignmentCondition | null | undefined
    if (dto.condition === undefined) {
      newCondition = undefined
    } else if (dto.condition === null) {
      newCondition = null
    } else {
      newCondition = validateAssignmentCondition(dto.condition)
    }
    const effectiveCondition =
      newCondition !== undefined ? newCondition : (assignment.condition ?? null)

    if (effectiveCondition) {
      const projectedSiblings = otherSiblings.map((sibling) => ({
        ...sibling,
        position: shiftedPosition(
          sibling.position,
          assignment.position,
          newPosition,
        ),
      }))
      validateAssignmentConditionRules({
        condition: effectiveCondition,
        ownDefinition: assignment.definition,
        ownFinalPosition: newPosition,
        siblings: projectedSiblings,
      })
    }

    const positionChanged = newPosition !== assignment.position
    if (positionChanged) {
      const dependents = otherSiblings.filter(
        (sibling) =>
          sibling.condition?.controllingAssignmentId === assignmentId,
      )
      for (const dependent of dependents) {
        const dependentFinalPosition = shiftedPosition(
          dependent.position,
          assignment.position,
          newPosition,
        )
        if (dependentFinalPosition <= newPosition) {
          throw new ConflictException(
            `Cannot move to position ${newPosition} — assignment at position ${dependent.position} depends on this one and would no longer be at a higher position`,
          )
        }
      }
    }

    let updated: ProductSegmentAssignment
    try {
      if (!positionChanged) {
        await this.assignmentsRepository.update(assignmentId, {
          condition:
            newCondition !== undefined ? newCondition : assignment.condition,
        })
      } else {
        const queryRunner = this.dataSource.createQueryRunner()
        try {
          await queryRunner.connect()
          await queryRunner.startTransaction()
        } catch {
          throw new RequestTimeoutException(
            'Unable to process your request, please try again later',
          )
        }
        try {
          await moveAssignmentPosition(
            queryRunner.manager,
            assignmentId,
            assignment.productId,
            assignment.position,
            newPosition,
            newCondition !== undefined ? { condition: newCondition } : {},
          )
          await queryRunner.commitTransaction()
        } catch (error: unknown) {
          await queryRunner.rollbackTransaction()
          if (
            error instanceof QueryFailedError &&
            (error.driverError as { code?: string })?.code === '23505'
          ) {
            throw new ConflictException(
              'Could not reorder this assignment — position conflict',
            )
          }
          throw new RequestTimeoutException(
            'Unable to process your request, please try again later',
          )
        } finally {
          await queryRunner.release()
        }
      }

      const refetched: ProductSegmentAssignment | null =
        await this.assignmentsRepository.findOneBy({ id: assignmentId })
      if (!refetched) {
        throw new NotFoundException(
          `Assignment with id ${assignmentId} not found`,
        )
      }
      updated = refetched
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'Could not update this assignment — position conflict',
        )
      }
      throw error
    }

    this.logger.log(`Assignment updated — id=${assignmentId}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'ProductSegmentAssignment',
      assignmentId,
    )
    return updated
  }
}
