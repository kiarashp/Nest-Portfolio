import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class ChangeUserRoleProvider {
  private readonly logger = new Logger(ChangeUserRoleProvider.name)

  constructor(
    /**
     * inject `User` repository
     */
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    /** inject audit log service to record the role change */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Changes the role of a user. Only callable by an ADMIN (enforced at the route level).
   * The acting admin's id is recorded in the audit log after a successful save.
   */
  public async changeUserRole(
    id: number,
    role: UserRole,
    activeUserId: number,
  ): Promise<User> {
    // An admin can never change their own role — this could demote them
    // below ADMIN, either locking them out of admin-only routes immediately
    // or, if they are the last admin, stranding the system with no admin.
    if (id === activeUserId) {
      throw new ForbiddenException('You cannot change your own role')
    }

    const user = await this.usersRepository.findOneBy({ id })
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`)
    }

    const previousRole = user.role
    user.role = role

    try {
      const saved = await this.usersRepository.save(user)
      this.logger.log(
        `Role changed — userId=${id}, from=${previousRole}, to=${role}`,
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
        `Failed to change role — userId=${id}`,
        (error as Error).stack,
      )
      throw new ConflictException(error, {
        description: 'Could not update the user role',
      })
    }
  }
}
