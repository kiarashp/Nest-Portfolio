import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './entities/audit-log.entity'
import { User } from 'src/users/entities/user.entity'
import { AuditLogService } from './providers/audit-log.service'
import { FindAllAuditLogsProvider } from './providers/find-all-audit-logs.provider'
import { AuditLogController } from './audit-log.controller'
import { PaginationModule } from 'src/common/pagination/pagination.module'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User]), PaginationModule],
  providers: [AuditLogService, FindAllAuditLogsProvider],
  exports: [AuditLogService],
  controllers: [AuditLogController],
})
export class AuditLogModule {}
