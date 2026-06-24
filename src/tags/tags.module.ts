import { Module } from '@nestjs/common'
import { TagsController } from './tags.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Tag } from './entities/tag.entity'
import { TagsService } from './providers/tags.service'
import { UpdateTagProvider } from './providers/update-tag.provider'
import { AuditLogModule } from 'src/audit-log/audit-log.module'

@Module({
  controllers: [TagsController],
  imports: [TypeOrmModule.forFeature([Tag]), AuditLogModule],
  providers: [TagsService, UpdateTagProvider],
  exports: [TagsService],
})
export class TagsModule {}
