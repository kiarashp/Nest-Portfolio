import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { UsersService } from 'src/users/providers/users.service'
import { SignInDto } from '../dtos/signin.dto'
import { SignInProvider } from './sign-in.provider'
import { RefreshTokenDto } from '../dtos/refresh-token.dto'
import { RefreshTokensProvider } from './refresh-tokens.provider'

@Injectable()
export class AuthService {
  constructor(
    /**
     * inject user service
     */
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    /**
     * inject sign in provider
     */
    private readonly signInProvider: SignInProvider,
    /**
     * inject refresh tokens provider
     */
    private readonly refreshTokensProvider: RefreshTokensProvider,
  ) {}

  /**
   * Authenticates a user and generates access and refresh tokens.
   */
  public async signIn(signInDto: SignInDto) {
    return await this.signInProvider.signIn(signInDto)
  }

  /**
   * check refresh token and generates new access and refresh tokens.
   */
  public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    return await this.refreshTokensProvider.refreshTokens(refreshTokenDto)
  }
}
