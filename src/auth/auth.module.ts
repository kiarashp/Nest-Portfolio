import { Module, forwardRef } from '@nestjs/common'
import { AuthService } from './providers/auth.service'
import { AuthController } from './auth.controller'
import { UsersModule } from 'src/users/users.module'
import { HashingProvider } from './providers/hashing.provider'
import { BcryptProvider } from './providers/bcrypt.provider'
import { SignInProvider } from './providers/sign-in.provider'
import { ConfigModule } from '@nestjs/config'

import { JwtModule } from '@nestjs/jwt'
import { GenerateTokensProvider } from './providers/generate-tokens.provider'
import { RefreshTokensProvider } from './providers/refresh-tokens.provider'
import { GoogleAuthenticationController } from './social/google-authentication.controller'
import { GoogleAuthenticationService } from './social/providers/google-authentication.service'
import jwtConfig from './config/jwt.config'
@Module({
  controllers: [AuthController, GoogleAuthenticationController],
  providers: [
    AuthService,
    {
      provide: HashingProvider,
      useClass: BcryptProvider,
    },
    BcryptProvider,
    SignInProvider,
    GenerateTokensProvider,
    RefreshTokensProvider,
    GoogleAuthenticationService,
  ],
  imports: [
    forwardRef(() => UsersModule),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
  exports: [AuthService, HashingProvider],
})
export class AuthModule {}
