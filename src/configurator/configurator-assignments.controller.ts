import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ConfiguratorAssignmentsService } from './providers/configurator-assignments.service'
import { ProductSegmentAssignment } from './entities/product-segment-assignment.entity'
import { UpdateAssignmentDto } from './dtos/update-assignment.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

/**
 * Admin update/delete for a single ProductSegmentAssignment
 * (CONFIGURATOR.md §5.1, §7 Step 4). Not nested under a product id in the
 * URL — the assignment id alone is enough to locate its product — so unlike
 * ConfiguratorProductsController's POST :id/assignments, these routes live in
 * their own controller with a base prefix (a single path family, same rule
 * ConfiguratorProductsController itself follows).
 */
@ApiTags('Configurator - Assignments')
@Controller('configurator-assignments')
export class ConfiguratorAssignmentsController {
  constructor(
    private readonly configuratorAssignmentsService: ConfiguratorAssignmentsService,
  ) {}

  /**
   * update an assignment's position and/or condition — a position change
   * reorders siblings and is re-validated against every direction rule a
   * shift could break
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Update an assignment's position/condition (admin only)",
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ProductSegmentAssignment)
  @ApiResponse({
    status: 400,
    description:
      "Invalid position/condition, or the move would break this assignment's own condition",
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({
    status: 409,
    description: "Move would break a dependent assignment's condition",
  })
  @Patch(':assignmentId')
  public update(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateAssignmentDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorAssignmentsService.update(
      assignmentId,
      dto,
      adminId,
    )
  }

  /**
   * delete an assignment — rejected if any other assignment's condition
   * targets this one as its controller; renumbers remaining positions on success
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an assignment (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({
    status: 409,
    description: 'Controls one or more dependent assignments',
  })
  @Delete(':assignmentId')
  public delete(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorAssignmentsService.delete(assignmentId, adminId)
  }
}
