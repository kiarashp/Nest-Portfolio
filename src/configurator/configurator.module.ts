import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigurableProduct } from './entities/configurable-product.entity'
import { SegmentDefinition } from './entities/segment-definition.entity'
import { SegmentOption } from './entities/segment-option.entity'
import { ProductSegmentAssignment } from './entities/product-segment-assignment.entity'
import { AuditLogModule } from 'src/audit-log/audit-log.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { UploadsModule } from 'src/uploads/uploads.module'

// Ordering-code configurator: the admin defines reusable segment
// definitions and assembles them into configurable products; customers
// compose an ordering code position by position and the resolver validates
// selections and renders the code + human summary. Fully separate from the
// existing products module. Step 1 only wires entities and shared modules —
// controllers/services/providers are added in later steps (see
// CONFIGURATOR.md).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigurableProduct,
      SegmentDefinition,
      SegmentOption,
      ProductSegmentAssignment,
    ]),
    AuditLogModule,
    PaginationModule,
    UploadsModule,
  ],
})
export class ConfiguratorModule {}
