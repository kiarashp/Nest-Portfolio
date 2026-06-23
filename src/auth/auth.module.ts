import { Module } from '@nestjs/common'
import { AuthService } from './providers/auth.service'
import { AuthController } from './auth.controller'
import { UsersModule } from 'src/users/users.module'
import { SignInProvider } from './providers/sign-in.provider'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { GenerateTokensProvider } from './providers/generate-tokens.provider'
import { RefreshTokensProvider } from './providers/refresh-tokens.provider'
import { GoogleAuthenticationController } from './social/google-authentication.controller'
import { GoogleAuthenticationService } from './social/providers/google-authentication.service'
import { ChangePasswordProvider } from './providers/change-password.provider'
import jwtConfig from './config/jwt.config'
import { CryptoModule } from 'src/crypto/crypto.module'

@Module({
  controllers: [AuthController, GoogleAuthenticationController],
  providers: [
    AuthService,
    SignInProvider,
    GenerateTokensProvider,
    RefreshTokensProvider,
    GoogleAuthenticationService,
    ChangePasswordProvider,
  ],
  imports: [
    UsersModule,
    CryptoModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
  exports: [AuthService],
})
export class AuthModule {}
