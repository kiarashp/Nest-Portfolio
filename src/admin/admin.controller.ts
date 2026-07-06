import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'
import { AdminStatsService } from './providers/admin-stats.service'
import { AdminStatsDto } from './dto/admin-stats.dto'

@Controller('admin')
@ApiTags('Admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    /** inject admin stats service for the dashboard aggregate */
    private readonly adminStatsService: AdminStatsService,
  ) {}

  /**
   * Returns dashboard statistics: posts by status, product publish counts,
   * product type count, user count, and contact submission count. Admin only.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(AdminStatsDto)
  public getStats() {
    return this.adminStatsService.getStats()
  }
}
