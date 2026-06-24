import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import jwtConfig from '../config/jwt.config'
import type { ConfigType } from '@nestjs/config'
import { GenerateTokensProvider } from './generate-tokens.provider'
import { UsersService } from 'src/users/providers/users.service'
import { RefreshTokenPayload } from '../interfaces/refresh-token-payload'

@Injectable()
export class RefreshTokensProvider {
  private readonly logger = new Logger(RefreshTokensProvider.name)

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
    private readonly usersService: UsersService,
  ) {}

  // Takes a plain { refreshToken: string } instead of RefreshTokenDto because
  // the DTO's refreshToken field is optional (to let the ValidationPipe pass
  // browser requests that carry the token in an HttpOnly cookie rather than the
  // body). By the time the controller calls this method it has already resolved
  // the token from whichever source was present and guaranteed it is a string.
  public async refreshTokens({ refreshToken }: { refreshToken: string }) {
    let payload: RefreshTokenPayload
    // verify the refresh token using jwt service
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.jwtConfiguration.secret,
          audience: this.jwtConfiguration.audience,
          issuer: this.jwtConfiguration.issuer,
        },
      )
    } catch {
      this.logger.warn('Refresh token rejected: invalid or expired token')
      throw new UnauthorizedException('Invalid refresh token')
    }
    //based on the id , fetch the user from the database.
    const user = await this.usersService.findOneById(payload.sub)

    this.logger.log(`Tokens rotated — userId=${payload.sub}`)
    // generate new access token and refresh token
    return this.generateTokensProvider.generateTokens(user)
  }
}
