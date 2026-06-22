import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AvatarOption } from '../entities/avatar-option.entity'
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
     * Inject AvatarOption repository to look up the option by id
     */
    @InjectRepository(AvatarOption)
    private readonly avatarOptionRepo: Repository<AvatarOption>,

    /**
     * Inject FindOneByIdProvider to look up the user before updating
     */
    private readonly findOneByIdProvider: FindOneByIdProvider,
  ) {}

  /**
   * Sets the user's avatar to the Cloudinary URL for the given avatar option id.
   * Throws BadRequestException if the id does not match any active avatar option.
   */
  public async selectAvatar(
    avatarOptionId: number,
    userId: number,
  ): Promise<User> {
    const option = await this.avatarOptionRepo.findOne({
      where: { id: avatarOptionId },
    })
    if (!option) throw new BadRequestException('Invalid avatar option')

    const user = await this.findOneByIdProvider.findOneById(userId)
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
