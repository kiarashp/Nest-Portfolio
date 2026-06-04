import {
  Injectable,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

@Injectable()
export class FindOneUserByEmailProvider {
  constructor(
    /**
     * inject user repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * find user by email
   */
  public async findOneByEmail(email: string) {
    let user: User | null = null
    try {
      user = await this.userRepository.findOneBy({ email })
    } catch (error) {
      throw new RequestTimeoutException(
        error,
        'Unable to process your request, please try again later',
      )
    }

    if (!user) {
      throw new UnauthorizedException('User does not exist')
    }

    return user
  }
}
