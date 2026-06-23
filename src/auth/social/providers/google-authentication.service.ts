import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { LoginTicket, OAuth2Client } from 'google-auth-library'
import jwtConfig from 'src/auth/config/jwt.config'
import { GoogleTokenDto } from '../dto/google-token.dto'
import { UsersService } from 'src/users/providers/users.service'
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider'

@Injectable()
export class GoogleAuthenticationService implements OnModuleInit {
  private oauthClient!: OAuth2Client

  constructor(
    /**
     * Injecting jwtConfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    /**
     * inject user service
     */
    private readonly usersService: UsersService,
    /**
     * Inject generateTokens provider
     */
    private readonly generateTokensProvider: GenerateTokensProvider,
  ) {}

  onModuleInit() {
    const clientId = this.jwtConfiguration.googleClientId
    const clientSecret = this.jwtConfiguration.googleClientSecret

    this.oauthClient = new OAuth2Client(clientId, clientSecret)
  }

  public async authenticate(googleTokenDto: GoogleTokenDto) {
    //verify the Google Token sent by User
    let loginTicket: LoginTicket
    try {
      //  Attempt to verify the token
      loginTicket = await this.oauthClient.verifyIdToken({
        idToken: googleTokenDto.token,
      })
    } catch {
      // Catches expired tokens, bad signatures, or network errors during verification
      throw new UnauthorizedException('Google token verification failed: ')
    }
    //Check if the login ticket exists/is valid
    if (!loginTicket) {
      throw new UnauthorizedException('Invalid Google token')
    }
    //Extract the payload from Google JWT Token
    const payload = loginTicket.getPayload()
    if (!payload) {
      throw new UnauthorizedException('Invalid token payload')
    }
    const {
      email,
      email_verified,
      sub: googleId,
      given_name: firstName = '',
      family_name: lastName = '',
    } = payload
    /**
     * if email is not verified throw unauthorized exception. this is rare that
     * google account is not verified.
     */
    if (!email) {
      throw new UnauthorizedException('Email is missing from Google token')
    }

    if (!email_verified) {
      throw new UnauthorizedException('Google account email is not verified')
    }

    //Find the user in the database using the GoogleId
    const user = await this.usersService.findOneByGoogleId(googleId)
    //If google id exist in the database we generate access token and refresh token
    if (user) {
      // Update the stored name and email if Google is now returning different values.
      // This keeps the account data fresh without the user having to do anything.
      const synced = await this.usersService.syncGoogleUser(user, {
        email: email,
        firstName,
        lastName,
      })
      return this.generateTokensProvider.generateTokens(synced)
    }
    //if not exist , create a new user and then generate both tokens
    const newUser = await this.usersService.createGoogleUser({
      email,
      firstName,
      lastName,
      googleId,
    })
    return this.generateTokensProvider.generateTokens(newUser)
    //if faced error throw unauthorized exception
  }
}
