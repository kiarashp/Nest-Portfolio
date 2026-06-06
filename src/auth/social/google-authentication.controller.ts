import { Body, Controller, Post } from '@nestjs/common'
import { GoogleAuthenticationService } from './providers/google-authentication.service'
import { GoogleTokenDto } from './dto/google-token.dto'
import { Auth } from '../decorators/auth.decorator'
import { AuthType } from '../enums/auth-type.enum'

@Controller('google-authentication')
export class GoogleAuthenticationController {
  constructor(
    /**
     * Inject google authentication service
     */
    private readonly googleAuthenticationService: GoogleAuthenticationService,
  ) {}

  /**
   * Authenticate users with google
   */
  @Post()
  @Auth(AuthType.None)
  public async authenticate(@Body() googleTokenDto: GoogleTokenDto) {
    return this.googleAuthenticationService.authenticate(googleTokenDto)
  }
}
