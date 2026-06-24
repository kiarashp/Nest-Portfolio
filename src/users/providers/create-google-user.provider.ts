import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import { GoogleUser } from '../interfaces/google-user.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class CreateGoogleUserProvider {
  private readonly logger = new Logger(CreateGoogleUserProvider.name)

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
      const saved = await this.userRepository.save(user)
      this.logger.log(
        `Google user created — userId=${saved.id}, email=${saved.email}`,
      )
      return saved
    } catch (error) {
      this.logger.error(
        `Failed to create Google user — email=${googleUser.email}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Could not create user, please try again',
      })
    }
  }
}
