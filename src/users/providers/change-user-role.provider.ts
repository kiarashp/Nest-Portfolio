import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class ChangeUserRoleProvider {
  constructor(
    /**
     * inject `User` repository
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Changes the role of a user. Only callable by an ADMIN (enforced at the route level).
   */
  public async changeUserRole(id: number, role: UserRole): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id })
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`)
    }

    user.role = role

    try {
      return await this.usersRepository.save(user)
    } catch (error) {
      throw new ConflictException(error, {
        description: 'Could not update the user role',
      })
    }
  }
}
