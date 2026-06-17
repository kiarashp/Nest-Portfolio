import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import { GoogleUser } from '../interfaces/google-user.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class CreateGoogleUserProvider {
  constructor(
    /**
     * Inject user repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * create google user
   */
  public async createGoogleUser(googleUser: GoogleUser) {
    try {
      const user = this.userRepository.create({
        ...googleUser,
        role: UserRole.USER,
        isEmailVerified: true,
      })
      return await this.userRepository.save(user)
    } catch (error) {
      throw new ConflictException(error, {
        description: 'Could not create user, please try again',
      })
    }
  }
}
