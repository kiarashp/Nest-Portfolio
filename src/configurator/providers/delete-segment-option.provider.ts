import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SegmentOption } from '../entities/segment-option.entity'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteSegmentOptionProvider {
  private readonly logger = new Logger(DeleteSegmentOptionProvider.name)

  constructor(
    /** inject SegmentOption repository for deletion */
    @InjectRepository(SegmentOption)
    private readonly segmentOptionsRepository: Repository<SegmentOption>,
    /** inject ProductSegmentAssignment repository to check whether the parent
     * definition is assigned to any product */
    @InjectRepository(ProductSegmentAssignment)
    private readonly assignmentsRepository: Repository<ProductSegmentAssignment>,
    /** inject audit log service to record option deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Hard-deletes a segment option. If the parent definition is unassigned, any
   * option count is fine. If the definition is assigned to a product, deleting
   * this option must not drop the definition below 2 options — throws
   * ConflictException in that case. Unreachable via the API until Step 4 ships
   * assignments, but the guard is enforced now so it is correct once they exist.
   */
  public async delete(
    optionId: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    const option: SegmentOption | null =
      await this.segmentOptionsRepository.findOneBy({ id: optionId })
    if (!option) {
      throw new NotFoundException(
        `Segment option with id ${optionId} not found`,
      )
    }

    const assignmentCount = await this.assignmentsRepository.count({
      where: { definitionId: option.definitionId },
    })
    if (assignmentCount > 0) {
      const remainingOptionCount = await this.segmentOptionsRepository.count({
        where: { definitionId: option.definitionId },
      })
      if (remainingOptionCount - 1 < 2) {
        throw new ConflictException(
          'Cannot delete this option — it would leave an assigned SELECT definition with fewer than 2 options',
        )
      }
    }

    await this.segmentOptionsRepository.delete(optionId)
    this.logger.log(`Segment option deleted — id=${optionId}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.DELETE,
      'SegmentOption',
      optionId,
    )
    return { deleted: true, id: optionId }
  }
}
