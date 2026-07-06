import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { RemoveOneByIdProvider } from './remove-one-by-id.provider'
import { FindOneByIdProvider } from './find-one-by-id.provider'
import { User } from '../entities/user.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

// RemoveOneByIdProvider deletes a user by id. The repository, find-one-by-id
// provider, and audit log service are mocked so no real DB is needed.
describe('RemoveOneByIdProvider', () => {
  let provider: RemoveOneByIdProvider
  let userRepo: { remove: jest.Mock }
  let findOneByIdProvider: { findOneById: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    userRepo = { remove: jest.fn() }
    findOneByIdProvider = { findOneById: jest.fn() }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveOneByIdProvider,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: FindOneByIdProvider, useValue: findOneByIdProvider },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(RemoveOneByIdProvider)
  })

  it('throws ForbiddenException when the target id equals the active user id', async () => {
    await expect(provider.removeUserById(5, 5)).rejects.toThrow(
      ForbiddenException,
    )
    expect(findOneByIdProvider.findOneById).not.toHaveBeenCalled()
  })

  it('deletes the user and records an audit log entry', async () => {
    const user = { id: 1, email: 'target@e2e.test', firstName: 'Target' }
    findOneByIdProvider.findOneById.mockResolvedValue(user)
    userRepo.remove.mockResolvedValue(user)

    const result = await provider.removeUserById(1, 42)

    expect(userRepo.remove).toHaveBeenCalledWith(user)
    expect(auditLogService.log).toHaveBeenCalledWith(
      42,
      AuditAction.DELETE,
      'User',
      1,
    )
    expect(result.message).toContain('1')
  })

  it('throws InternalServerErrorException when the delete fails', async () => {
    const user = { id: 1, email: 'target@e2e.test', firstName: 'Target' }
    findOneByIdProvider.findOneById.mockResolvedValue(user)
    userRepo.remove.mockRejectedValue(new Error('db error'))

    await expect(provider.removeUserById(1, 42)).rejects.toThrow(
      InternalServerErrorException,
    )
  })
})
