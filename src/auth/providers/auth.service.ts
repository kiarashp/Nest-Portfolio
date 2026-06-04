import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { UsersService } from 'src/users/providers/users.service'
import { SignInDto } from '../dtos/signin.dto'
import { SignInProvider } from './sign-in.provider'

@Injectable()
export class AuthService {
  constructor(
    // injecting users service
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    /**
     * inject sign in provider
     */
    private readonly signInProvider: SignInProvider,
  ) {}

  // login
  public async signIn(signInDto: SignInDto) {
    return await this.signInProvider.signIn(signInDto)
  }
}
