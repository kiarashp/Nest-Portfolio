import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { PatchUserProfileDto } from '../dtos/patch-user-profile.dto'
import { FindOneByIdProvider } from './find-one-by-id.provider'

@Injectable()
export class PatchUserProfileProvider {
  private readonly logger = new Logger(PatchUserProfileProvider.name)

  constructor(
    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    /**
     * Inject FindOneByIdProvider
     */
    private readonly findOneByIdProvider: FindOneByIdProvider,
  ) {}

  /**
   * Lets a user update their own first and last name.
   * Email, password, and role cannot be changed here — each of those
   * has its own route with the right checks in place.
   */
  public async patchUserProfile(
    userId: number,
    dto: PatchUserProfileDto,
  ): Promise<User> {
    const user = await this.findOneByIdProvider.findOneById(userId)

    if (dto.firstName !== undefined) user.firstName = dto.firstName
    if (dto.lastName !== undefined) user.lastName = dto.lastName
    if (dto.bio !== undefined) user.bio = dto.bio

    const saved = await this.usersRepository.save(user)
    this.logger.log(`Profile updated — userId=${userId}`)
    return saved
  }
}
