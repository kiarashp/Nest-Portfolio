import {
  Injectable,
  Inject,
  forwardRef,
  RequestTimeoutException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { AuthService } from 'src/auth/providers/auth.service'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { CreateUserDto } from '../dtos/create-user.dtos'

@Injectable()
export class UsersService {
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
  /**
   * Find all users
   */
  public findAll(limit: number, page: number) {
    console.log(limit, page)
    return this.userRepository.find()
  }
  /**
   * Find user by id
   */
  public async findOneById(id: number) {
    let existingUser: User | null = null
    try {
      existingUser = await this.userRepository.findOne({ where: { id } })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        {
          description: 'Error connecting to database',
        },
      )
    }
    if (!existingUser) throw new NotFoundException('User not found')
    return existingUser
  }
  /**
   * Create a new user
   */
  public async craeteUser(createUserDto: CreateUserDto) {
    //check if user exist with the smae email
    let existingUser: User | null = null
    try {
      existingUser = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        {
          description: 'Error connecting to database',
        },
      )
    }

    //handle execption
    if (existingUser) throw new BadRequestException('User already exist')
    //create a new user
    let newUser: User | null = null
    try {
      newUser = this.userRepository.create(createUserDto)
      await this.userRepository.save(newUser)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        {
          description: 'Error connecting to database',
        },
      )
    }
    return newUser
  }
}
