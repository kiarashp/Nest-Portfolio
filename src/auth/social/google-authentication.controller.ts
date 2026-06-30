import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { GoogleAuthenticationService } from './providers/google-authentication.service'
import { GoogleTokenDto } from './dto/google-token.dto'
import { Auth } from '../decorators/auth.decorator'
import { AuthType } from '../enums/auth-type.enum'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'
import { AuthTokensDto } from '../dtos/auth-tokens.dto'

@Controller('google-authentication')
@ApiTags('Auth')
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
  @ApiOperation({ summary: 'Authenticate with a Google ID token' })
  @ApiDataResponse(AuthTokensDto, { description: 'Access and refresh tokens' })
  public async authenticate(@Body() googleTokenDto: GoogleTokenDto) {
    return this.googleAuthenticationService.authenticate(googleTokenDto)
  }
}
