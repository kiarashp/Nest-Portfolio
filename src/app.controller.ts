import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'
import { AppService } from './app.service'
import { Auth } from './auth/decorators/auth.decorator'
import { AuthType } from './auth/enums/auth-type.enum'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Returns 200 OK when the app is running — used by Coolify health checks. */
  @Get('health')
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  health(): { status: string } {
    return { status: 'ok' }
  }
}
