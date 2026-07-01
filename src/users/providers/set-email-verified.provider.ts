import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class SetEmailVerifiedProvider {
  private readonly logger = new Logger(SetEmailVerifiedProvider.name)

  constructor(
    /**
     * inject `User` repository
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    /** inject audit log service to record the change */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Sets the email verification status of a user. Only callable by an ADMIN
   * (enforced at the route level). When marking a user as verified, any
   * outstanding verification token is cleared so it can no longer be used.
   * The acting admin's id is recorded in the audit log after a successful save.
   */
  public async setEmailVerified(
    id: number,
    isEmailVerified: boolean,
    activeUserId: number,
  ): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id })
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`)
    }

    user.isEmailVerified = isEmailVerified
    if (isEmailVerified) {
      user.emailVerificationToken = null
      user.emailVerificationTokenExpiry = null
    }

    try {
      const saved = await this.usersRepository.save(user)
      this.logger.log(
        `Email verification status changed — userId=${id}, isEmailVerified=${isEmailVerified}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.UPDATE,
        'User',
        id,
      )
      return saved
    } catch (error) {
      this.logger.error(
        `Failed to change email verification status — userId=${id}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Could not update the user email verification status',
      })
    }
  }
}
