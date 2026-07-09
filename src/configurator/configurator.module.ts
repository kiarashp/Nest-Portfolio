import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigurableProduct } from './entities/configurable-product.entity'
import { SegmentDefinition } from './entities/segment-definition.entity'
import { SegmentOption } from './entities/segment-option.entity'
import { ProductSegmentAssignment } from './entities/product-segment-assignment.entity'
import { AuditLogModule } from 'src/audit-log/audit-log.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { UploadsModule } from 'src/uploads/uploads.module'
import { ConfiguratorDefinitionsController } from './configurator-definitions.controller'
import { ConfiguratorDefinitionsService } from './providers/configurator-definitions.service'
import { CreateSegmentDefinitionProvider } from './providers/create-segment-definition.provider'
import { FindAllSegmentDefinitionsProvider } from './providers/find-all-segment-definitions.provider'
import { FindOneSegmentDefinitionProvider } from './providers/find-one-segment-definition.provider'
import { UpdateSegmentDefinitionProvider } from './providers/update-segment-definition.provider'
import { DeleteSegmentDefinitionProvider } from './providers/delete-segment-definition.provider'
import { CreateSegmentOptionProvider } from './providers/create-segment-option.provider'
import { UpdateSegmentOptionProvider } from './providers/update-segment-option.provider'
import { DeleteSegmentOptionProvider } from './providers/delete-segment-option.provider'
import { ConfiguratorProductsController } from './configurator-products.controller'
import { ConfiguratorProductsService } from './providers/configurator-products.service'
import { CreateConfigurableProductProvider } from './providers/create-configurable-product.provider'
import { FindAllConfigurableProductsProvider } from './providers/find-all-configurable-products.provider'
import { FindOneConfigurableProductProvider } from './providers/find-one-configurable-product.provider'
import { UpdateConfigurableProductProvider } from './providers/update-configurable-product.provider'
import { DeleteConfigurableProductProvider } from './providers/delete-configurable-product.provider'
import { UploadConfigurableProductImageProvider } from './providers/upload-configurable-product-image.provider'
import { DeleteConfigurableProductImageProvider } from './providers/delete-configurable-product-image.provider'

// Ordering-code configurator: the admin defines reusable segment
// definitions and assembles them into configurable products; customers
// compose an ordering code position by position and the resolver validates
// selections and renders the code + human summary. Fully separate from the
// existing products module. Step 2 added the segment-definition library CRUD
// (+ options); Step 3 adds ConfigurableProduct CRUD + image. Assignments and
// the public resolver land in later steps (see CONFIGURATOR.md).
@Module({
  controllers: [
    ConfiguratorDefinitionsController,
    ConfiguratorProductsController,
  ],
  providers: [
    ConfiguratorDefinitionsService,
    CreateSegmentDefinitionProvider,
    FindAllSegmentDefinitionsProvider,
    FindOneSegmentDefinitionProvider,
    UpdateSegmentDefinitionProvider,
    DeleteSegmentDefinitionProvider,
    CreateSegmentOptionProvider,
    UpdateSegmentOptionProvider,
    DeleteSegmentOptionProvider,
    ConfiguratorProductsService,
    CreateConfigurableProductProvider,
    FindAllConfigurableProductsProvider,
    FindOneConfigurableProductProvider,
    UpdateConfigurableProductProvider,
    DeleteConfigurableProductProvider,
    UploadConfigurableProductImageProvider,
    DeleteConfigurableProductImageProvider,
  ],
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
