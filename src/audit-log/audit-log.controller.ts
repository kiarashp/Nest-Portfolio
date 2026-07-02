import { Controller, Get, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from './providers/audit-log.service'
import { GetAuditLogsDto } from './dto/get-audit-logs.dto'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiPaginatedResponse } from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { AuditLog } from './entities/audit-log.entity'

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
   * Accepts optional ?entity= and ?action= query params to narrow results,
   * and ?sortBy=/?order= to sort (default createdAt desc). Each row includes
   * a `user` snapshot of its actor (null if none, `deleted: true` if the
   * user has since been hard-deleted).
   */
  @Get()
  @ApiOperation({ summary: 'List audit log entries (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(AuditLog)
  public findAll(@Query() dto: GetAuditLogsDto, @Req() request: Request) {
    return this.auditLogService.findAll(dto, request)
  }
}
