import {
  Injectable,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common'
import { SignInDto } from '../dtos/signin.dto'
import { UsersService } from 'src/users/providers/users.service'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { GenerateTokensProvider } from './generate-tokens.provider'

@Injectable()
export class SignInProvider {
  constructor(
    /**
     * injec user service
     */
    private readonly userService: UsersService,
    /**
     * inject hashing provider
     */
    private readonly hashingProvider: HashingProvider,

    /**
     * inject generateTokens provider
     */
    private readonly generateTokensProvider: GenerateTokensProvider,
  ) {}

  /**
   * sign in
   */
  public async signIn(signInDto: SignInDto) {
    //find the user using email id
    //throw exception if user not found
    const user = await this.userService.findOneByEmail(signInDto.email)
    if (!user.password) {
      throw new UnauthorizedException('This account uses Google Sign-In')
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before signing in',
      )
    }
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
    //send tokens
    return this.generateTokensProvider.generateTokens(user)
  }
}
