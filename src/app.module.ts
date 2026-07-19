import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { UsersModule } from './users/users.module'
import { PostsModule } from './posts/posts.module'
import { AuthModule } from './auth/auth.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TagsModule } from './tags/tags.module'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PaginationModule } from './common/pagination/pagination.module'
import appConfig from './config/app.config'
import databaseConfig from './config/database.config'
import cloudinaryConfig from './config/cloudinary.config'
import uploadsConfig from './config/uploads.config'
import environmentValidation from './config/environment.validation'
import jwtConfig from './auth/config/jwt.config'
import { UploadsModule } from './uploads/uploads.module'
import { MailModule } from './mail/mail.module'
import { ContactModule } from './contact/contact.module'
import { JwtModule } from '@nestjs/jwt'
import { AccessTokenGuard } from './auth/guards/access-token/access-token.guard'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ClassSerializerInterceptor } from '@nestjs/common'
import { AuthenticationGuard } from './auth/guards/authentication/authentication.guard'
import { RolesGuard } from './auth/guards/authorization/roles.guard'
import { DataResponseInterceptor } from './common/interceptors/data-response/data-response.interceptor'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { TerminusModule } from '@nestjs/terminus'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuditLogModule } from './audit-log/audit-log.module'
import { ProductsModule } from './products/products.module'
import { ConfiguratorModule } from './configurator/configurator.module'
import { AdminModule } from './admin/admin.module'
import { isDevelopmentEnvironment } from './common/throttle/is-development.util'

const ENV = process.env.NODE_ENV

@Module({
  imports: [
    // Global default limit is relaxed under NODE_ENV=development so local
    // Playwright/frontend test runs aren't rate-limited on every route (e.g.
    // GET /users/me) — test/staging/production keep the real 60/60s limit.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: isDevelopmentEnvironment ? 1_000_000 : 60,
      },
    ]),
    TerminusModule,
    EventEmitterModule.forRoot(),
    UsersModule,
    PostsModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: !ENV ? '.env' : `.env.${ENV}`,
      load: [appConfig, databaseConfig, cloudinaryConfig, uploadsConfig],
      validationSchema: environmentValidation,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        autoLoadEntities: configService.get('database.autoLoadEntities'),
        synchronize: configService.get('database.synchronize'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        host: configService.get('database.host'),
        database: configService.get('database.name'),
      }),
    }),
    TagsModule,
    PaginationModule,
    UploadsModule,
    MailModule,
    ContactModule,
    AuditLogModule,
    ProductsModule,
    ConfiguratorModule,
    AdminModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
  controllers: [AppController],
  providers: [
    // ThrottlerGuard runs first — rate-limits before auth guard touches the DB
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    { provide: APP_INTERCEPTOR, useClass: DataResponseInterceptor },
    // registered after DataResponseInterceptor so it runs on the raw controller
    // output before the response gets wrapped in { apiVersion, data }
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    AccessTokenGuard,
  ],
})
export class AppModule {}
