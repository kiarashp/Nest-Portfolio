import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigurableProduct } from './entities/configurable-product.entity'
import { SegmentDefinition } from './entities/segment-definition.entity'
import { SegmentOption } from './entities/segment-option.entity'
import { ProductSegmentAssignment } from './entities/product-segment-assignment.entity'
import { User } from 'src/users/entities/user.entity'
import { AuditLogModule } from 'src/audit-log/audit-log.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { UploadsModule } from 'src/uploads/uploads.module'
import { MailModule } from 'src/mail/mail.module'
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
import { ConfiguratorAssignmentsController } from './configurator-assignments.controller'
import { ConfiguratorAssignmentsService } from './providers/configurator-assignments.service'
import { FindOneAssignmentProvider } from './providers/find-one-assignment.provider'
import { CreateAssignmentProvider } from './providers/create-assignment.provider'
import { UpdateAssignmentProvider } from './providers/update-assignment.provider'
import { DeleteAssignmentProvider } from './providers/delete-assignment.provider'
import { ConfiguratorsController } from './configurators.controller'
import { ConfiguratorsService } from './providers/configurators.service'
import { FindPublishedConfiguratorProductsProvider } from './providers/find-published-configurator-products.provider'
import { ConfiguratorResolverService } from './providers/configurator-resolver.service'
import { SavedConfiguration } from './entities/saved-configuration.entity'
import { QuoteMessage } from './entities/quote-message.entity'
import { SavedConfigurationsController } from './saved-configurations.controller'
import { SavedConfigurationsService } from './providers/saved-configurations.service'
import { SaveConfigurationProvider } from './providers/save-configuration.provider'
import { FindMySavedConfigurationsProvider } from './providers/find-my-saved-configurations.provider'
import { FindOneSavedConfigurationProvider } from './providers/find-one-saved-configuration.provider'
import { DeleteSavedConfigurationProvider } from './providers/delete-saved-configuration.provider'
import { RequestQuoteSavedConfigurationProvider } from './providers/request-quote-saved-configuration.provider'
import { FindAllSavedConfigurationsAdminProvider } from './providers/find-all-saved-configurations-admin.provider'
import { UpdateQuoteStatusProvider } from './providers/update-quote-status.provider'
import { CountUnreadQuoteMessagesProvider } from './providers/count-unread-quote-messages.provider'
import { FindQuoteMessagesProvider } from './providers/find-quote-messages.provider'
import { CreateQuoteMessageProvider } from './providers/create-quote-message.provider'
import { QuoteEventsListener } from './listeners/quote-events.listener'

// Ordering-code configurator: the admin defines reusable segment
// definitions and assembles them into configurable products; customers
// compose an ordering code position by position and the resolver validates
// selections and renders the code + human summary. Fully separate from the
// existing products module. Step 2 added the segment-definition library CRUD
// (+ options); Step 3 added ConfigurableProduct CRUD + image; Step 4 added
// assignments (placing a SegmentDefinition at a position inside a
// ConfigurableProduct, with optional zero-fill conditions); Step 5 added the
// public endpoints — GET /configurators/:slug (form schema) and POST
// /configurators/:slug/resolve (the resolver); Step 6 adds Phase 2's
// SavedConfiguration — frozen snapshots of resolved configurations owned by
// registered users (POST /configurators/:slug/save + the owner-scoped
// /saved-configurations routes); Step 7 adds the request-quote endpoint
// (POST /saved-configurations/:id/request-quote), which stamps
// quoteRequestedAt and emits AppEvents.QUOTE_REQUESTED to email the site
// owner via MailModule — see CONFIGURATOR.md. Each quote request also
// carries a ticket-style message thread (QuoteMessage): owner and admin
// */messages routes, a quoteStatus lifecycle (PENDING/ANSWERED/CLOSED),
// per-side unread counts, and two-way email notifications via the
// quote-message events.
@Module({
  controllers: [
    ConfiguratorDefinitionsController,
    ConfiguratorProductsController,
    ConfiguratorAssignmentsController,
    ConfiguratorsController,
    SavedConfigurationsController,
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
    ConfiguratorAssignmentsService,
    FindOneAssignmentProvider,
    CreateAssignmentProvider,
    UpdateAssignmentProvider,
    DeleteAssignmentProvider,
    ConfiguratorsService,
    FindPublishedConfiguratorProductsProvider,
    ConfiguratorResolverService,
    SavedConfigurationsService,
    SaveConfigurationProvider,
    FindMySavedConfigurationsProvider,
    FindOneSavedConfigurationProvider,
    DeleteSavedConfigurationProvider,
    RequestQuoteSavedConfigurationProvider,
    FindAllSavedConfigurationsAdminProvider,
    UpdateQuoteStatusProvider,
    CountUnreadQuoteMessagesProvider,
    FindQuoteMessagesProvider,
    CreateQuoteMessageProvider,
    QuoteEventsListener,
  ],
  imports: [
    TypeOrmModule.forFeature([
      ConfigurableProduct,
      SegmentDefinition,
      SegmentOption,
      ProductSegmentAssignment,
      SavedConfiguration,
      QuoteMessage,
      User,
    ]),
    AuditLogModule,
    PaginationModule,
    UploadsModule,
    MailModule,
  ],
})
export class ConfiguratorModule {}
