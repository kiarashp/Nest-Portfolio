import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { DataSource } from 'typeorm'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { FindOneAssignmentProvider } from './find-one-assignment.provider'
import { shiftPositionsDownAfter } from './renumber-assignments.util'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteAssignmentProvider {
  private readonly logger = new Logger(DeleteAssignmentProvider.name)

  constructor(
    /** inject DataSource to run the delete + position-shift inside a transaction */
    private readonly dataSource: DataSource,
    /** inject find-one provider to load the assignment and its product siblings */
    private readonly findOneAssignmentProvider: FindOneAssignmentProvider,
    /** inject audit log service to record assignment deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Hard-deletes an assignment. Rejected outright if any other assignment in
   * the same product has a condition targeting this one as its controller —
   * no reorder can rescue that, unlike a position change. On success, every
   * assignment after the deleted position shifts down by one inside a
   * transaction, keeping positions gapless.
   */
  public async delete(
    assignmentId: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    const assignment =
      await this.findOneAssignmentProvider.findOneByIdOrFail(assignmentId)
    const dependents = (assignment.product.assignments ?? []).filter(
      (sibling) =>
        sibling.id !== assignmentId &&
        sibling.condition?.controllingAssignmentId === assignmentId,
    )
    if (dependents.length > 0) {
      const positions = dependents
        .map((dependent) => dependent.position)
        .sort((a, b) => a - b)
      throw new ConflictException(
        `Cannot delete this assignment — it controls assignment(s) at position(s): ${positions.join(', ')}`,
      )
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

    try {
      await queryRunner.manager.delete(ProductSegmentAssignment, assignmentId)
      await shiftPositionsDownAfter(
        queryRunner.manager,
        assignment.productId,
        assignment.position,
      )
      await queryRunner.commitTransaction()
    } catch {
      await queryRunner.rollbackTransaction()
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    } finally {
      await queryRunner.release()
    }

    this.logger.log(`Assignment deleted — id=${assignmentId}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.DELETE,
      'ProductSegmentAssignment',
      assignmentId,
    )
    return { deleted: true, id: assignmentId }
  }
}
