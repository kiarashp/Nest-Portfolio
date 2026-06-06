import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

@Injectable()
export class FindOneByGoogleIdProvider {
  constructor(
    /**
     * inject user repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * find user by google id
   * do not handle execption when user is not found
   */
  public async findOneByGoogleId(googleId: string): Promise<User | null> {
    try {
      return await this.userRepository.findOneBy({ googleId })
    } catch (error) {
      // Handle unexpected database or network crashes
      throw new InternalServerErrorException(
        'An error occurred while connecting to the authentication database',
        { cause: error }, // Attaches the original error for debugging/logging purposes
      )
    }
  }
}
