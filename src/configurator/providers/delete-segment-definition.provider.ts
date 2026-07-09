import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { SegmentDefinition } from '../entities/segment-definition.entity'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { FindOneSegmentDefinitionProvider } from './find-one-segment-definition.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteSegmentDefinitionProvider {
  private readonly logger = new Logger(DeleteSegmentDefinitionProvider.name)

  constructor(
    /** inject SegmentDefinition repository for deletion */
    @InjectRepository(SegmentDefinition)
    private readonly segmentDefinitionsRepository: Repository<SegmentDefinition>,
    /** inject ProductSegmentAssignment repository to check for dependent products */
    @InjectRepository(ProductSegmentAssignment)
    private readonly assignmentsRepository: Repository<ProductSegmentAssignment>,
    /** inject find-one provider for the 404 guard */
    private readonly findOneSegmentDefinitionProvider: FindOneSegmentDefinitionProvider,
    /** inject audit log service to record definition deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Hard-deletes a segment definition. Throws ConflictException naming every
   * product that still has an assignment referencing it — callers must remove
   * those assignments first. Unreachable via the API until Step 4 ships
   * assignments, but the guard is enforced now. A 23503 FK violation on the
   * delete itself (a product assigned between the count-check and the delete —
   * same accepted race as DeleteProductTypeProvider) maps to the same error, as
   * a defensive backstop for the RESTRICT FK on ProductSegmentAssignment.definitionId.
   */
  public async delete(
    id: number,
    activeUserId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    await this.findOneSegmentDefinitionProvider.findOneByIdOrFail(id)

    const assignments = await this.assignmentsRepository.find({
      where: { definitionId: id },
      relations: { product: true },
    })
    if (assignments.length > 0) {
      const productNames = [...new Set(assignments.map((a) => a.product.name))]
      throw new ConflictException(
        `Cannot delete this segment definition — used by product(s): ${productNames.join(', ')}`,
      )
    }

    try {
      await this.segmentDefinitionsRepository.delete(id)
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23503'
      ) {
        throw new ConflictException(
          'Cannot delete this segment definition — it is still assigned to a product',
        )
      }
      throw error
    }

    this.logger.log(`Segment definition deleted — id=${id}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.DELETE,
      'SegmentDefinition',
      id,
    )
    return { deleted: true, id }
  }
}
