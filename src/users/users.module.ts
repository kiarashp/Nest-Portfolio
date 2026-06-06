import { Module, forwardRef } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './providers/users.service'
import { AuthModule } from 'src/auth/auth.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './entities/user.entity'
import { UserCreateManyProvider } from './providers/user-create-many.provider'
import { CreateUserProvider } from './providers/create-user.provider'
import { FindOneUserByEmailProvider } from './providers/find-one-user-by-email.provider'
import { ConfigModule } from '@nestjs/config'
import jwtConfig from 'src/auth/config/jwt.config'
import { JwtModule } from '@nestjs/jwt'
import { AccessTokenGuard } from 'src/auth/guards/access-token/access-token.guard'
import { APP_GUARD } from '@nestjs/core'
import { FindOneByGoogleIdProvider } from './providers/find-one-by-google-id.provider';
import { CreateGoogleUserProvider } from './providers/create-google-user.provider';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    UserCreateManyProvider,
    CreateUserProvider,
    FindOneUserByEmailProvider,
    FindOneByGoogleIdProvider,
    CreateGoogleUserProvider,
  ],
  exports: [UsersService],
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([User]),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
})
export class UsersModule {}
