import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { UsersService } from 'src/users/providers/users.service'
import { SignInDto } from '../dtos/signin.dto'
import { SignInProvider } from './sign-in.provider'
import { RefreshTokensProvider } from './refresh-tokens.provider'
import { ChangePasswordProvider } from './change-password.provider'
import { ChangePasswordDto } from '../dtos/change-password.dto'

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
    /**
     * inject change password provider
     */
    private readonly changePasswordProvider: ChangePasswordProvider,
  ) {}

  /**
   * Authenticates a user and generates access and refresh tokens.
   */
  public async signIn(signInDto: SignInDto) {
    return await this.signInProvider.signIn(signInDto)
  }

  /**
   * Verifies the refresh token and issues a new token pair.
   * Accepts { refreshToken: string } rather than RefreshTokenDto because the
   * controller resolves the token from either the HttpOnly cookie or the request
   * body before calling here, so it is always a guaranteed string at this point.
   */
  public async refreshTokens(dto: { refreshToken: string }) {
    return await this.refreshTokensProvider.refreshTokens(dto)
  }

  public async verifyEmail(token: string) {
    return this.usersService.verifyEmail(token)
  }

  public async resendVerificationEmail(email: string) {
    return this.usersService.resendVerificationEmail(email)
  }

  /**
   * Start the password reset flow for the given email address.
   */
  public async forgotPassword(email: string) {
    return this.usersService.forgotPassword(email)
  }

  /**
   * Set a new password using the token from the reset email.
   */
  public async resetPassword(token: string, newPassword: string) {
    return this.usersService.resetPassword(token, newPassword)
  }

  /**
   * Change the password for a logged-in user after verifying the current password.
   */
  public async changePassword(userId: number, dto: ChangePasswordDto) {
    return this.changePasswordProvider.changePassword(userId, dto)
  }
}
