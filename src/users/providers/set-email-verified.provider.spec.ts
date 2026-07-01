import { ConflictException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { SetEmailVerifiedProvider } from './set-email-verified.provider'
import { User } from '../entities/user.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

// SetEmailVerifiedProvider toggles a user's isEmailVerified flag.
// The repository and audit log service are mocked so no real DB is needed.
describe('SetEmailVerifiedProvider', () => {
  let provider: SetEmailVerifiedProvider
  let userRepo: { findOneBy: jest.Mock; save: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    userRepo = { findOneBy: jest.fn(), save: jest.fn() }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmailVerifiedProvider,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(SetEmailVerifiedProvider)
  })

  it('throws NotFoundException when the user does not exist', async () => {
    userRepo.findOneBy.mockResolvedValue(null)

    await expect(provider.setEmailVerified(99, true, 1)).rejects.toThrow(
      NotFoundException,
    )
  })

  it('marks the user verified and clears any outstanding verification token', async () => {
    const user: Record<string, unknown> = {
      id: 1,
      isEmailVerified: false,
      emailVerificationToken: 'some-token',
      emailVerificationTokenExpiry: new Date(),
    }
    userRepo.findOneBy.mockResolvedValue(user)
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u))

    const result = await provider.setEmailVerified(1, true, 42)

    expect(result.isEmailVerified).toBe(true)
    expect(result.emailVerificationToken).toBeNull()
    expect(result.emailVerificationTokenExpiry).toBeNull()
    expect(auditLogService.log).toHaveBeenCalledWith(
      42,
      AuditAction.UPDATE,
      'User',
      1,
    )
  })

  it('un-verifies the user without touching the token fields', async () => {
    const user: Record<string, unknown> = {
      id: 1,
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiry: null,
    }
    userRepo.findOneBy.mockResolvedValue(user)
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u))

    const result = await provider.setEmailVerified(1, false, 42)

    expect(result.isEmailVerified).toBe(false)
    expect(result.emailVerificationToken).toBeNull()
  })

  it('throws ConflictException when the save fails', async () => {
    userRepo.findOneBy.mockResolvedValue({ id: 1, isEmailVerified: false })
    userRepo.save.mockRejectedValue(new Error('db error'))

    await expect(provider.setEmailVerified(1, true, 42)).rejects.toThrow(
      ConflictException,
    )
  })
})
