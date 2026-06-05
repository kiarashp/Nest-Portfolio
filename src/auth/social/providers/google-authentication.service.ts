import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { OAuth2Client } from 'google-auth-library'
import jwtConfig from 'src/auth/config/jwt.config'

@Injectable()
export class GoogleAuthenticationService implements OnModuleInit {
  private oauthClient!: OAuth2Client

  constructor(
    /**
     * Injecting jwtConfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  onModuleInit() {
    const clientId = this.jwtConfiguration.googleClientId
    const clientSecret = this.jwtConfiguration.googleClientSecret

    this.oauthClient = new OAuth2Client(clientId, clientSecret)
  }
}
