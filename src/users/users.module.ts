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
import { FindOneByGoogleIdProvider } from './providers/find-one-by-google-id.provider'
import { CreateGoogleUserProvider } from './providers/create-google-user.provider'
import { RemoveOneByIdProvider } from './providers/remove-one-by-id.provider'
import { FindOneByIdProvider } from './providers/find-one-by-id.provider'
import { UploadAvatarProvider } from './providers/upload-avatar.provider'
import { ChangeUserRoleProvider } from './providers/change-user-role.provider'
import { VerifyEmailProvider } from './providers/verify-email.provider'
import { ResendVerificationProvider } from './providers/resend-verification.provider'
import { PatchUserProvider } from './providers/patch-user.provider'
import { PatchUserProfileProvider } from './providers/patch-user-profile.provider'
import { SyncGoogleUserProvider } from './providers/sync-google-user.provider'
import { UploadsModule } from 'src/uploads/uploads.module'
import { MailModule } from 'src/mail/mail.module'

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    UserCreateManyProvider,
    CreateUserProvider,
    FindOneUserByEmailProvider,
    FindOneByGoogleIdProvider,
    CreateGoogleUserProvider,
    RemoveOneByIdProvider,
    FindOneByIdProvider,
    UploadAvatarProvider,
    ChangeUserRoleProvider,
    VerifyEmailProvider,
    ResendVerificationProvider,
    PatchUserProvider,
    PatchUserProfileProvider,
    SyncGoogleUserProvider,
  ],
  exports: [UsersService],
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([User]),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    UploadsModule,
    MailModule,
  ],
})
export class UsersModule {}
