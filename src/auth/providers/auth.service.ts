import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { UsersService } from 'src/users/providers/users.service'

@Injectable()
export class AuthService {
  constructor(
    // injecting users service
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  // login
  public async login(id: number, email?: string, password?: string) {
    console.log(email, password)
    const user = await this.usersService.findOneById(id)
    if (user?.firstName === 'Satoru') return 'SAMPLE_TOKEN'
    return 'NO_TOKEN'
  }

  // Authenticate
  public isAuth(token: string) {
    if (token === 'SAMPLE_TOKEN') return true
    return false
  }
}
