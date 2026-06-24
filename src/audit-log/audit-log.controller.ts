import { Controller, Get, Query } from '@nestjs/common'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from './providers/audit-log.service'
import { GetAuditLogsDto } from './dto/get-audit-logs.dto'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

@Controller('audit-logs')
@ApiTags('Audit Logs')
@Roles(UserRole.ADMIN)
export class AuditLogController {
  constructor(
    /** inject audit log service for paginated listing */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Returns a paginated list of audit log entries. Admin only.
   * Accepts optional ?entity= and ?action= query params to narrow results.
   */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List audit log entries (admin only)' })
  public findAll(@Query() dto: GetAuditLogsDto) {
    return this.auditLogService.findAll(dto)
  }
}
