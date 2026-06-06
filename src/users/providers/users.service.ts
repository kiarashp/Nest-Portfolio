import {
  Injectable,
  Inject,
  forwardRef,
  RequestTimeoutException,
  NotFoundException,
} from '@nestjs/common'
import { AuthService } from 'src/auth/providers/auth.service'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { CreateUserDto } from '../dtos/create-user.dtos'
import { UserCreateManyProvider } from './user-create-many.provider'
import { CreateManyUsersDto } from '../dtos/create-many-users.dto'
import { CreateUserProvider } from './create-user.provider'
import { FindOneUserByEmailProvider } from './find-one-user-by-email.provider'
import { FindOneByGoogleIdProvider } from './find-one-by-google-id.provider'
import { CreateGoogleUserProvider } from './create-google-user.provider'
import { GoogleUser } from '../interfaces/google-user.interface'

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
    /**
     * Inject craete user provider
     */
    private readonly createUserProvider: CreateUserProvider,
    /**
     * Injec create many provider
     */
    private readonly userCreateManyProvider: UserCreateManyProvider,
    /**
     * Inject find one user by email provider
     */
    private readonly findOneUserByEmailProvider: FindOneUserByEmailProvider,
    /**
     * Inject find one by google id
     */
    private readonly findOneByGoogleIdProvider: FindOneByGoogleIdProvider,
    /**
     * Inject createGoogleUser provider
     */
    private readonly createGoogleUserProvider: CreateGoogleUserProvider,
  ) {}
  /**
   * Find all users
   */
  public findAll(limit: number, page: number) {
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
    return await this.createUserProvider.craeteUser(createUserDto)
  }
  /**
   * create multiple new users
   */
  public async createMany(createManyUsersDto: CreateManyUsersDto) {
    return await this.userCreateManyProvider.createMany(createManyUsersDto)
  }

  /**
   * Find user by email
   */
  public async findOneByEmail(email: string) {
    return await this.findOneUserByEmailProvider.findOneByEmail(email)
  }
  /**
   * Find one by google id
   */
  public async findOneByGoogleId(googleId: string) {
    return await this.findOneByGoogleIdProvider.findOneByGoogleId(googleId)
  }
  /**
   * Create google user
   */
  public async createGoogleUser(googleUser: GoogleUser) {
    return await this.createGoogleUserProvider.createGoogleUser(googleUser)
  }
}
