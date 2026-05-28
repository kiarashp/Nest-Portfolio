import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { AuthService } from 'src/auth/providers/auth.service'

@Injectable()
export class UsersService {
  private fakeDatabase = [
    {
      id: 1,
      name: 'Naruto Uzumaki',
      email: 'naruto@hokage.com',
      password: '123456',
    },
    {
      id: 2,
      name: 'Ichigo Kurosaki',
      email: 'ichigo@bleach.com',
      password: '123456789',
    },
    {
      id: 3,
      name: 'Orihime Yoshikage',
      email: 'orihime@bleach.com',
      password: '987654321',
    },
    {
      id: 4,
      name: 'Monkey D. Luffy',
      email: 'luffy@pirateking.com',
      password: 'meatlover123',
    },
    {
      id: 5,
      name: 'Goku Son',
      email: 'goku@capsulecorp.com',
      password: 'supergoku12',
    },
  ]
  constructor(
    // injecting auth service
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}
  // find all users
  public findAll(limit: number, page: number) {
    console.log(limit, page)
    return this.fakeDatabase
  }
  // find one user by id
  public findOneById(id: number) {
    const user = this.fakeDatabase.find((user) => user.id === id)
    const isAuth = this.authService.isAuth('SAMPLE_TOKEN2')
    return { ...user, isAuth }
  }
}
