import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { AuthService } from './providers/auth.service'
import { SignInDto } from './dtos/signin.dto'
import { Auth } from './decorators/auth.decorator'
import { AuthType } from './enums/auth-type.enum'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Auth(AuthType.None)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  public async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto)
  }
}
