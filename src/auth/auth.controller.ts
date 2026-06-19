import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import type { Request, Response } from 'express'
import { AuthService } from './providers/auth.service'
import { SignInDto } from './dtos/signin.dto'
import { Auth } from './decorators/auth.decorator'
import { AuthType } from './enums/auth-type.enum'
import { RefreshTokenDto } from './dtos/refresh-token.dto'
import { VerifyEmailDto } from './dtos/verify-email.dto'
import { ResendVerificationDto } from './dtos/resend-verification.dto'
import { ForgotPasswordDto } from './dtos/forgot-password.dto'
import { ResetPasswordDto } from './dtos/reset-password.dto'
import jwtConfig from './config/jwt.config'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh-tokens',
      maxAge: this.jwtConfiguration.refreshTokenTtl * 1000,
    })
  }

  /**
   * sign in route to get refresh token and access token
   */
  @Auth(AuthType.None)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  public async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signIn(signInDto)
    this.setRefreshTokenCookie(res, tokens.refreshToken)
    return tokens
  }

  /**
   * refresh token route to get new access token.
   * Accepts the refresh token from either the HttpOnly cookie (browser clients)
   * or the request body (mobile clients). The token is always required — the DTO
   * field is optional only so the ValidationPipe doesn't reject browser requests
   * that carry no body; the controller enforces presence itself.
   */
  @Auth(AuthType.None)
  @Post('refresh-tokens')
  @HttpCode(HttpStatus.OK)
  public async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      (req.cookies?.refreshToken as string | undefined) ??
      refreshTokenDto.refreshToken
    if (!token) {
      throw new UnauthorizedException('Refresh token is required')
    }
    const tokens = await this.authService.refreshTokens({ refreshToken: token })
    this.setRefreshTokenCookie(res, tokens.refreshToken)
    return tokens
  }

  /**
   * clears the HttpOnly refresh token cookie for browser clients.
   * Mobile clients can call this too — the missing cookie is silently ignored.
   */
  @Auth(AuthType.None)
  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  public signOut(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh-tokens',
    })
    return { message: 'Signed out successfully' }
  }

  @Auth(AuthType.None)
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  public async verifyEmail(@Query() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token)
  }

  @Auth(AuthType.None)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  public async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email)
  }

  @Auth(AuthType.None)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  public async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  @Auth(AuthType.None)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  public async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword)
  }
}
