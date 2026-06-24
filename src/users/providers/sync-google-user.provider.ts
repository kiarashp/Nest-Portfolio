import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

interface GoogleFields {
  email: string
  firstName: string
  lastName: string
}

@Injectable()
export class SyncGoogleUserProvider {
  private readonly logger = new Logger(SyncGoogleUserProvider.name)

  constructor(
    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Called every time a Google user signs in again.
   * Updates their name and email if Google is now returning different values.
   * Email is only updated if no other account already has that email address.
   */
  public async sync(user: User, googleFields: GoogleFields): Promise<User> {
    let changed = false

    if (googleFields.firstName !== user.firstName) {
      user.firstName = googleFields.firstName
      changed = true
    }

    if (googleFields.lastName !== user.lastName) {
      user.lastName = googleFields.lastName
      changed = true
    }

    // Only update the email if it actually changed.
    // We skip the update if another account already owns the new email —
    // better to keep the old email than to fail the login entirely.
    if (googleFields.email !== user.email) {
      const conflict = await this.usersRepository.findOneBy({
        email: googleFields.email,
      })
      if (!conflict) {
        user.email = googleFields.email
        changed = true
      }
    }

    if (changed) {
      this.logger.log(`Google user profile synced — userId=${user.id}`)
      return this.usersRepository.save(user)
    }

    return user
  }
}
