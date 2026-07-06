import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import { FindOneByIdProvider } from './find-one-by-id.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class RemoveOneByIdProvider {
  private readonly logger = new Logger(RemoveOneByIdProvider.name)

  constructor(
    /**
     * injecting user repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /**
     * injecting findOneById provider
     */
    private readonly findOneByIdProvider: FindOneByIdProvider,
    /** inject audit log service to record the deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Deletes the user with the given id. The acting admin's id is recorded in
   * the audit log after a successful deletion.
   */
  public async removeUserById(id: number, activeUserId: number) {
    // An admin can never delete their own account — this would either lock
    // them out immediately or, if they are the last admin, strand the system
    // with no admin at all.
    if (id === activeUserId) {
      throw new ForbiddenException('You cannot delete your own account')
    }

    const user = await this.findOneByIdProvider.findOneById(id)

    try {
      await this.userRepository.remove(user)
    } catch (error) {
      this.logger.error(
        `Failed to delete user — userId=${id}`,
        (error as Error).stack,
      )
      throw new InternalServerErrorException('Error deleting user', {
        cause: error,
      })
    }
    this.logger.log(`User deleted — userId=${id}, email=${user.email}`)
    await this.auditLogService.log(activeUserId, AuditAction.DELETE, 'User', id)
    return {
      message: `User with id ${id} and email ${user.email} and name ${user.firstName} has been deleted`,
    }
  }
}
