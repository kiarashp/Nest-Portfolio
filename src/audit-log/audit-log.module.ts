import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './entities/audit-log.entity'
import { AuditLogService } from './providers/audit-log.service'
import { AuditLogController } from './audit-log.controller'
import { PaginationModule } from 'src/common/pagination/pagination.module'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), PaginationModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
  controllers: [AuditLogController],
})
export class AuditLogModule {}
