import { Injectable } from '@nestjs/common'
import { UpdateAssignmentProvider } from './update-assignment.provider'
import { DeleteAssignmentProvider } from './delete-assignment.provider'
import { UpdateAssignmentDto } from '../dtos/update-assignment.dto'

/**
 * Thin facade over the assignment update/delete providers, one method per
 * route. Mirrors ConfiguratorProductsService/ConfiguratorDefinitionsService.
 */
@Injectable()
export class ConfiguratorAssignmentsService {
  constructor(
    private readonly updateAssignmentProvider: UpdateAssignmentProvider,
    private readonly deleteAssignmentProvider: DeleteAssignmentProvider,
  ) {}

  public update(
    assignmentId: number,
    dto: UpdateAssignmentDto,
    activeUserId: number,
  ) {
    return this.updateAssignmentProvider.update(assignmentId, dto, activeUserId)
  }

  public delete(assignmentId: number, activeUserId: number) {
    return this.deleteAssignmentProvider.delete(assignmentId, activeUserId)
  }
}
