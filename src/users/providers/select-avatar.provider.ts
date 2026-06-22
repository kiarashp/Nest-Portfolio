import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AVATAR_OPTIONS } from '../constants/avatar-options'
import { User } from '../entities/user.entity'
import { FindOneByIdProvider } from './find-one-by-id.provider'

@Injectable()
export class SelectAvatarProvider {
  constructor(
    /**
     * Inject User repository to update avatarUrl on the user record
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    /**
     * Inject FindOneByIdProvider to look up the user before updating
     */
    private readonly findOneByIdProvider: FindOneByIdProvider,
  ) {}

  /**
   * Sets the user's avatar to the Cloudinary URL matching the given key.
   * The key is already validated by SelectAvatarDto before this runs.
   */
  public async selectAvatar(avatarKey: string, userId: number): Promise<User> {
    const user = await this.findOneByIdProvider.findOneById(userId)

    // Safe to assert non-null — dto validation already confirmed the key exists
    const option = AVATAR_OPTIONS.find((o) => o.key === avatarKey)!
    user.avatarUrl = option.url

    try {
      return await this.usersRepository.save(user)
    } catch (error) {
      throw new ConflictException(error, {
        description: 'Could not update the user avatar',
      })
    }
  }
}
