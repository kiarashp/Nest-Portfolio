import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from 'src/users/entities/user.entity'
import { Post } from 'src/posts/entities/post.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import databaseConfig from 'src/config/database.config'

/**
 * Minimal module used only by seed scripts.
 *
 * Intentionally does NOT import AppModule or any feature module — we don't
 * need guards, interceptors, JWT, Cloudinary, or Joi validation here. All we
 * need is a DB connection and the User entity so the seed can read and write
 * the users table.
 *
 * NestFactory.createApplicationContext(SeedModule) boots this context without
 * starting an HTTP server, giving us the full DI system for a one-off script.
 */
@Module({
  imports: [
    // Load .env (or .env.<NODE_ENV>) without the full Joi validation schema,
    // because the seed script only needs DB_* vars — not JWT, Cloudinary, etc.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: !process.env.NODE_ENV
        ? '.env'
        : `.env.${process.env.NODE_ENV}`,
      load: [databaseConfig],
    }),

    // Connect to Postgres using the same config namespace the rest of the app
    // uses (database.*), so the seed reads the same .env values.
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
        // Explicitly list entities instead of relying on autoLoadEntities,
        // which only works when every module that registers entities is loaded.
        // TypeORM resolves inverse-relation metadata at startup, so every
        // entity in the relation graph must be registered — even ones the seed
        // doesn't read or write.
        entities: [User, Post, Tag, MetaOption, UploadFile],
        // Never let a script auto-migrate the schema — that is migrations' job.
        synchronize: false,
      }),
    }),

    // Register the User repository so we can inject it via getRepositoryToken.
    TypeOrmModule.forFeature([User]),
  ],
})
export class SeedModule {}
