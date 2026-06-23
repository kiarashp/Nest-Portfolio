import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { PatchUserDto } from '../dtos/patch-user.dto'
import { FindOneByIdProvider } from './find-one-by-id.provider'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'

@Injectable()
export class PatchUserProvider {
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

    // Hashes the new password when the admin supplies one in the patch body
    @Inject(HashingProvider)
    private readonly hashingProvider: HashingProvider,
  ) {}

  /**
   * Updates any allowed field on a user. Only admins can call this.
   * Role changes are not handled here — use the dedicated role route for that.
   */
  public async patchUser(id: number, dto: PatchUserDto): Promise<User> {
    const user = await this.findOneByIdProvider.findOneById(id)

    if (dto.email && dto.email !== user.email) {
      // We query the DB directly here instead of using FindOneUserByEmailProvider
      // because that provider throws an error when no user is found,
      // but in this case "not found" is actually the good outcome we want
      const existing = await this.usersRepository.findOneBy({
        email: dto.email,
      })
      if (existing) {
        throw new BadRequestException(
          `Email ${dto.email} is already in use by another account`,
        )
      }
      user.email = dto.email
    }

    if (dto.password) {
      user.password = await this.hashingProvider.hashPassword(dto.password)
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName
    if (dto.lastName !== undefined) user.lastName = dto.lastName

    return this.usersRepository.save(user)
  }
}
