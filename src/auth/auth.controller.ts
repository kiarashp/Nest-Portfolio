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
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { isDevelopmentEnvironment } from 'src/common/throttle/is-development.util'
import { AuthService } from './providers/auth.service'
import { SignInDto } from './dtos/signin.dto'
import { Auth } from './decorators/auth.decorator'
import { AuthType } from './enums/auth-type.enum'
import { RefreshTokenDto } from './dtos/refresh-token.dto'
import { VerifyEmailDto } from './dtos/verify-email.dto'
import { ResendVerificationDto } from './dtos/resend-verification.dto'
import { ForgotPasswordDto } from './dtos/forgot-password.dto'
import { ResetPasswordDto } from './dtos/reset-password.dto'
import { ChangePasswordDto } from './dtos/change-password.dto'
import { ActiveUser } from './decorators/active-user.decorator'
import type { ActiveUserData } from './interfaces/active-user-data.interface'
import jwtConfig from './config/jwt.config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { AuthTokensDto } from './dtos/auth-tokens.dto'
import { MessageResponseDto } from 'src/common/dto/message-response.dto'

@Controller('auth')
@ApiTags('Auth')
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
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiDataResponse(AuthTokensDto, { description: 'Access and refresh tokens' })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiDataResponse(AuthTokensDto, {
    description: 'New access and refresh tokens',
  })
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
  @ApiOperation({
    summary: 'Clear the refresh token cookie (browser sign-out)',
  })
  @ApiDataResponse(MessageResponseDto)
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
  @ApiOperation({ summary: 'Verify an email address from the emailed token' })
  @ApiDataResponse(MessageResponseDto)
  public async verifyEmail(@Query() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token)
  }

  @Auth(AuthType.None)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Resend the email verification link' })
  @ApiDataResponse(MessageResponseDto)
  public async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email)
  }

  @Auth(AuthType.None)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Start the password reset flow' })
  @ApiDataResponse(MessageResponseDto)
  public async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  @Auth(AuthType.None)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Set a new password using the reset token' })
  @ApiDataResponse(MessageResponseDto)
  public async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword)
  }

  /**
   * Change the password for the currently authenticated user.
   * Requires a valid Bearer token. Google-only accounts are rejected.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Change the current user’s password' })
  @ApiAuth()
  @ApiDataResponse(MessageResponseDto)
  public async changePassword(
    @Body() dto: ChangePasswordDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.authService.changePassword(activeUser.sub, dto)
  }
}
