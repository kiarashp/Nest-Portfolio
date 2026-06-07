import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'

@Injectable()
export class FindOneByIdProvider {
  constructor(
    /**
     * injecting user repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * find user by id
   * handle execption when user is not found
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
}
