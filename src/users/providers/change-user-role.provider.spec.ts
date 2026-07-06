import { ConflictException, ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ChangeUserRoleProvider } from './change-user-role.provider'
import { User } from '../entities/user.entity'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

// ChangeUserRoleProvider updates a user's role. The repository and audit log
// service are mocked so no real DB is needed.
describe('ChangeUserRoleProvider', () => {
  let provider: ChangeUserRoleProvider
  let userRepo: { findOneBy: jest.Mock; save: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    userRepo = { findOneBy: jest.fn(), save: jest.fn() }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeUserRoleProvider,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(ChangeUserRoleProvider)
  })

  it('throws ForbiddenException when the target id equals the active user id', async () => {
    await expect(provider.changeUserRole(5, UserRole.ADMIN, 5)).rejects.toThrow(
      ForbiddenException,
    )
    expect(userRepo.findOneBy).not.toHaveBeenCalled()
  })

  it('updates the role and records an audit log entry', async () => {
    const user = { id: 1, role: UserRole.USER }
    userRepo.findOneBy.mockResolvedValue(user)
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u))

    const result = await provider.changeUserRole(1, UserRole.EDITOR, 42)

    expect(result.role).toBe(UserRole.EDITOR)
    expect(auditLogService.log).toHaveBeenCalledWith(
      42,
      AuditAction.UPDATE,
      'User',
      1,
    )
  })

  it('throws ConflictException when the save fails', async () => {
    userRepo.findOneBy.mockResolvedValue({ id: 1, role: UserRole.USER })
    userRepo.save.mockRejectedValue(new Error('db error'))

    await expect(
      provider.changeUserRole(1, UserRole.EDITOR, 42),
    ).rejects.toThrow(ConflictException)
  })
})
