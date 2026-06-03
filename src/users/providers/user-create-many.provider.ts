import {
  ConflictException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { User } from '../entities/user.entity'
import { DataSource } from 'typeorm'
import { CreateManyUsersDto } from '../dtos/create-many-users.dto'

@Injectable()
export class UserCreateManyProvider {
  constructor(
    /**
     * Inject Datasource
     */
    private dataSource: DataSource,
  ) {}
  /**
   * create multiple new users
   */
  public async createMany(createManyUsersDto: CreateManyUsersDto) {
    const newUsers: User[] = []
    //create querry runner instance
    const queryRunner = this.dataSource.createQueryRunner()
    try {
      //connecdt querry runner to datasource
      await queryRunner.connect()
      //start transaction
      await queryRunner.startTransaction()
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }

    try {
      for (const user of createManyUsersDto.users) {
        const newUser = queryRunner.manager.create(User, user)
        const result = await queryRunner.manager.save(newUser)
        newUsers.push(result)
      }
      //if success commit
      await queryRunner.commitTransaction()
    } catch (error) {
      // if fail roll back
      await queryRunner.rollbackTransaction()
      throw new ConflictException('Could not create users, please try again', {
        description: String(error),
      })
    } finally {
      try {
        //Release connection
        await queryRunner.release()
      } catch (error) {
        console.error(error)
      }
    }
    return newUsers
  }
}
