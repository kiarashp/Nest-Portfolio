import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { RefreshTokenDto } from '../dtos/refresh-token.dto'
import { JwtService } from '@nestjs/jwt'
import jwtConfig from '../config/jwt.config'
import type { ConfigType } from '@nestjs/config'
import { GenerateTokensProvider } from './generate-tokens.provider'
import { UsersService } from 'src/users/providers/users.service'
import { RefreshTokenPayload } from '../interfaces/refresh-token-payload'

@Injectable()
export class RefreshTokensProvider {
  constructor(
    /**
     * Inject the jwt service
     */
    private readonly jwtService: JwtService,

    /**
     * Inject jwtconfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    /**
     * Inject generateTokens provider
     */
    private readonly generateTokensProvider: GenerateTokensProvider,
    /**
     * Inject usersService
     */
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    let payload: RefreshTokenPayload
    // verify the refresh token using jwt service
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshTokenDto.refreshToken,
        {
          secret: this.jwtConfiguration.secret,
          audience: this.jwtConfiguration.audience,
          issuer: this.jwtConfiguration.issuer,
        },
      )
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
    //based on the id , fetch the user from the database.
    const user = await this.usersService.findOneById(payload.sub)

    // generate new access token and refresh token
    return this.generateTokensProvider.generateTokens(user)
  }
}
