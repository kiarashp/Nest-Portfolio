import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import jwtConfig from '../config/jwt.config'
import { User } from 'src/users/entities/user.entity'
import { ActiveUserData } from '../interfaces/active-user-data.interface'
import { GeneratedTokens } from '../interfaces/generated-tokens'

@Injectable()
export class GenerateTokensProvider {
  private readonly logger = new Logger(GenerateTokensProvider.name)

  constructor(
    /**
     * Inject JwtService
     */
    private readonly jwtService: JwtService,
    /**
     * Inject jwtconfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * sign token
   */
  public async signToken<T>(userId: number, expiresIn: number, payload?: T) {
    return await this.jwtService.signAsync(
      {
        sub: userId,
        ...payload,
      },
      {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        expiresIn: expiresIn,
      },
    )
  }
  /**
   * generate both access token and refresh token
   */
  public async generateTokens(user: User): Promise<GeneratedTokens> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        // generate the access token
        this.signToken<Partial<ActiveUserData>>(
          user.id,
          this.jwtConfiguration.accessTokenTtl,
          {
            email: user.email,
            role: user.role,
          },
        ),
        // generate the refresh token
        this.signToken<Partial<ActiveUserData>>(
          user.id,
          this.jwtConfiguration.refreshTokenTtl,
        ),
      ])
      this.logger.debug(`Tokens generated — userId=${user.id}`)
      return { accessToken, refreshToken }
    } catch (error) {
      this.logger.error(
        `Token generation failed — userId=${user.id}`,
        (error as Error).stack,
      )
      throw new InternalServerErrorException(
        'Failed to generate authentication tokens',
        { cause: error },
      )
    }
  }
}
