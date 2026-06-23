import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './providers/users.service'
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
import { SelectAvatarProvider } from './providers/select-avatar.provider'
import { ChangeUserRoleProvider } from './providers/change-user-role.provider'
import { VerifyEmailProvider } from './providers/verify-email.provider'
import { ResendVerificationProvider } from './providers/resend-verification.provider'
import { PatchUserProvider } from './providers/patch-user.provider'
import { PatchUserProfileProvider } from './providers/patch-user-profile.provider'
import { SyncGoogleUserProvider } from './providers/sync-google-user.provider'
import { ForgotPasswordProvider } from './providers/forgot-password.provider'
import { ResetPasswordProvider } from './providers/reset-password.provider'
import { MailModule } from 'src/mail/mail.module'
import { UploadsModule } from 'src/uploads/uploads.module'
import { AvatarOptionsProvider } from './providers/avatar-options.provider'
import { AvatarOption } from './entities/avatar-option.entity'
import { CryptoModule } from 'src/crypto/crypto.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { FindAllUsersProvider } from './providers/find-all-users.provider'

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    FindAllUsersProvider,
    UserCreateManyProvider,
    CreateUserProvider,
    FindOneUserByEmailProvider,
    FindOneByGoogleIdProvider,
    CreateGoogleUserProvider,
    RemoveOneByIdProvider,
    FindOneByIdProvider,
    SelectAvatarProvider,
    ChangeUserRoleProvider,
    VerifyEmailProvider,
    ResendVerificationProvider,
    PatchUserProvider,
    PatchUserProfileProvider,
    SyncGoogleUserProvider,
    ForgotPasswordProvider,
    ResetPasswordProvider,
    AvatarOptionsProvider,
  ],
  exports: [UsersService],
  imports: [
    CryptoModule,
    PaginationModule,
    TypeOrmModule.forFeature([User, AvatarOption]),
    UploadsModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    MailModule,
  ],
})
export class UsersModule {}
