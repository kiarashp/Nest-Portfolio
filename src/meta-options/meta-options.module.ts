import { Module } from '@nestjs/common'
import { MetaOptionsController } from './meta-options.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MetaOption } from './entities/meta-option.entity'
import { MetaOptionsService } from './provieders/meta-options.service'
import { FindOneMetaOptionProvider } from './providers/find-one-meta-option.provider'
import { UpdateMetaOptionProvider } from './providers/update-meta-option.provider'
import { DeleteMetaOptionProvider } from './providers/delete-meta-option.provider'
import { AuditLogModule } from 'src/audit-log/audit-log.module'

@Module({
  controllers: [MetaOptionsController],
  imports: [TypeOrmModule.forFeature([MetaOption]), AuditLogModule],
  providers: [
    MetaOptionsService,
    FindOneMetaOptionProvider,
    UpdateMetaOptionProvider,
    DeleteMetaOptionProvider,
  ],
})
export class MetaOptionsModule {}
