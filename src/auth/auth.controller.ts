import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common'
import { AuthService } from './providers/auth.service'
import { SignInDto } from './dtos/signin.dto'
import { Auth } from './decorators/auth.decorator'
import { AuthType } from './enums/auth-type.enum'
import { RefreshTokenDto } from './dtos/refresh-token.dto'
import { VerifyEmailDto } from './dtos/verify-email.dto'
import { ResendVerificationDto } from './dtos/resend-verification.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  /**
   * sign in route to get refresh token and access token
   */
  @Auth(AuthType.None)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  public async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto)
  }
  /**
   * refresh token route to get new access token
   */
  @Auth(AuthType.None)
  @Post('refresh-tokens')
  @HttpCode(HttpStatus.OK)
  public async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto)
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
}
