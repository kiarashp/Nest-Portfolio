import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { User } from 'src/users/entities/user.entity'
import { Post } from 'src/posts/entities/post.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { AvatarOption } from 'src/users/entities/avatar-option.entity'
import { AuditLog } from 'src/audit-log/entities/audit-log.entity'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { ConfigurableProduct } from 'src/configurator/entities/configurable-product.entity'
import { SegmentDefinition } from 'src/configurator/entities/segment-definition.entity'
import { SegmentOption } from 'src/configurator/entities/segment-option.entity'
import { ProductSegmentAssignment } from 'src/configurator/entities/product-segment-assignment.entity'
import { SavedConfiguration } from 'src/configurator/entities/saved-configuration.entity'
import { QuoteMessage } from 'src/configurator/entities/quote-message.entity'
import appConfig from 'src/config/app.config'
import databaseConfig from 'src/config/database.config'
import { TagsModule } from 'src/tags/tags.module'
import { PostsModule } from 'src/posts/posts.module'
import { ProductsModule } from 'src/products/products.module'
import { ConfiguratorModule } from 'src/configurator/configurator.module'

/**
 * Extended module used only by dev-data.seed.ts. Unlike the minimal SeedModule
 * (used by admin.seed.ts), this pulls in TagsModule, PostsModule,
 * ProductsModule, and ConfiguratorModule so the seed script can create tags,
 * posts, products, and the FRH configurator through their real service layer —
 * getting DTO-shaped validation, audit logging, and real image uploads (via
 * the active StorageProvider) for free. Never used in production.
 */
@Module({
  imports: [
    // PostsModule imports UsersModule, whose CreateUserProvider depends on
    // EventEmitter2 (normally provided globally by AppModule). Registered
    // here too so the DI graph resolves outside the full HTTP app context.
    EventEmitterModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: !process.env.NODE_ENV
        ? '.env'
        : `.env.${process.env.NODE_ENV}`,
      // appConfig is needed so LocalDiskStorageProvider reads the real
      // APP_URL when building upload URLs (see src/uploads/CLAUDE.md) instead
      // of silently falling back to http://localhost:3000. UploadsModule's
      // own uploads/cloudinary config namespaces register themselves via
      // ConfigModule.forFeature inside that module, so they don't need to be
      // listed here — only appConfig is read through the generic ConfigService.
      load: [databaseConfig, appConfig],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        // Every entity reachable from TagsModule/PostsModule/ProductsModule/
        // ConfiguratorModule must be listed here — TypeORM resolves relation
        // metadata for all of them at startup, even entities this script
        // never reads or writes (AvatarOption comes in via PostsModule ->
        // UsersModule, AuditLog via AuditLogModule, imported by every feature
        // module here; SavedConfiguration/QuoteMessage are part of
        // ConfiguratorModule's own TypeOrmModule.forFeature even though this
        // script never creates saved configurations).
        entities: [
          User,
          Post,
          Tag,
          UploadFile,
          AvatarOption,
          AuditLog,
          Product,
          ProductType,
          ConfigurableProduct,
          SegmentDefinition,
          SegmentOption,
          ProductSegmentAssignment,
          SavedConfiguration,
          QuoteMessage,
        ],
        synchronize: false,
      }),
    }),

    // Direct repository access for user writes and slug/name idempotency checks.
    TypeOrmModule.forFeature([
      User,
      Tag,
      Post,
      Product,
      ProductType,
      ConfigurableProduct,
      SegmentDefinition,
    ]),

    // Real service layer for tags, posts, products, and the FRH configurator.
    TagsModule,
    PostsModule,
    ProductsModule,
    ConfiguratorModule,
  ],
})
export class DevSeedModule {}
