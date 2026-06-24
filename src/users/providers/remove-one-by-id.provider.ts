import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import { FindOneByIdProvider } from './find-one-by-id.provider'

@Injectable()
export class RemoveOneByIdProvider {
  private readonly logger = new Logger(RemoveOneByIdProvider.name)

  constructor(
    /**
     * injecting user repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /**
     * injecting findOneById provider
     */
    private readonly findOneByIdProvider: FindOneByIdProvider,
  ) {}

  /**
   * remove user by id
   */
  public async removeUserById(id: number) {
    const user = await this.findOneByIdProvider.findOneById(id)

    try {
      await this.userRepository.remove(user)
    } catch (error) {
      this.logger.error(
        `Failed to delete user — userId=${id}`,
        (error as Error).stack,
      )
      throw new InternalServerErrorException('Error deleting user', {
        cause: error,
      })
    }
    this.logger.log(`User deleted — userId=${id}, email=${user.email}`)
    return {
      message: `User with id ${id} and email ${user.email} and name ${user.firstName} has been deleted`,
    }
  }
}
