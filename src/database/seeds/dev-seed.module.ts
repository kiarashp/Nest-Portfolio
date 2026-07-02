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
import databaseConfig from 'src/config/database.config'
import { TagsModule } from 'src/tags/tags.module'
import { PostsModule } from 'src/posts/posts.module'
import { ProductsModule } from 'src/products/products.module'

/**
 * Extended module used only by dev-data.seed.ts. Unlike the minimal SeedModule
 * (used by admin.seed.ts), this pulls in TagsModule, PostsModule, and
 * ProductsModule so the seed script can create tags, posts, and products
 * through their real service layer — getting DTO-shaped validation and audit
 * logging for free. Never used in production.
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
      load: [databaseConfig],
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
        // Every entity reachable from TagsModule/PostsModule/ProductsModule
        // must be listed here — TypeORM resolves relation metadata for all of
        // them at startup, even entities this script never reads or writes
        // (AvatarOption comes in via PostsModule -> UsersModule, AuditLog via
        // AuditLogModule, imported by all three feature modules).
        entities: [
          User,
          Post,
          Tag,
          UploadFile,
          AvatarOption,
          AuditLog,
          Product,
          ProductType,
        ],
        synchronize: false,
      }),
    }),

    // Direct repository access for user writes and slug/email idempotency checks.
    TypeOrmModule.forFeature([User, Tag, Post, Product, ProductType]),

    // Real service layer for tags, posts, and products.
    TagsModule,
    PostsModule,
    ProductsModule,
  ],
})
export class DevSeedModule {}
