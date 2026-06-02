import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { AuthService } from 'src/auth/providers/auth.service'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { CreateUserDto } from '../dtos/create-user.dtos'

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
    /**
     * Injecting Auth Service
     */
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,

    /**
     * Injecting UserRepository
     */
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}
  // find all users
  public findAll(limit: number, page: number) {
    console.log(limit, page)
    return this.fakeDatabase
  }
  // find one user by id
  public async findOneById(id: number) {
    return await this.userRepository.findOneBy({ id })
  }
  // create a new user
  public async craeteUser(createUserDto: CreateUserDto) {
    //check if user exist with the smae email
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    })
    if (existingUser) throw new Error('User already exist')
    //handle execption
    //create a new user
    const newUser = this.userRepository.create(createUserDto)
    return this.userRepository.save(newUser)
  }
}
