import {
  forwardRef,
  Inject,
  Injectable,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common'
import { SignInDto } from '../dtos/signin.dto'
import { UsersService } from 'src/users/providers/users.service'
import { HashingProvider } from './hashing.provider'
import { JwtService } from '@nestjs/jwt'
import type { ConfigType } from '@nestjs/config'
import jwtConfig from '../config/jwt.config'

@Injectable()
export class SignInProvider {
  constructor(
    /**
     * injec user service
     */
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    /**
     * inject hashing provider
     */
    private readonly hashingProvider: HashingProvider,
    /**
     * inject jwt service
     */
    private readonly jwtService: JwtService,
    /**
     * Inject jwtconfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * sign in
   */
  public async signIn(signInDto: SignInDto) {
    //find the user using email id
    //throw exception if user not found
    const user = await this.userService.findOneByEmail(signInDto.email)
    //compare password to the hashed password
    let isEqual: boolean = false
    try {
      isEqual = await this.hashingProvider.comparePassword(
        signInDto.password,
        user.password,
      )
    } catch (error) {
      throw new RequestTimeoutException(
        error,
        'Unable to process your request, please try again later',
      )
    }

    if (!isEqual) throw new UnauthorizedException('Invalid credentials')
    //send token
    const accessToken = this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        expiresIn: this.jwtConfiguration.accessTokenTtl,
      },
    )

    return accessToken
  }
}
