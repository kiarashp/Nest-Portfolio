import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AuditLogService } from './audit-log.service'
import { AuditLog } from '../entities/audit-log.entity'
import { AuditAction } from '../enums/audit-action.enum'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'

describe('AuditLogService', () => {
  let service: AuditLogService
  let saveMock: jest.Mock

  beforeEach(async () => {
    saveMock = jest.fn().mockResolvedValue(undefined)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: { save: saveMock, count: jest.fn(), find: jest.fn() },
        },
        // PaginationProvider is a singleton — a simple stub is enough here
        {
          provide: PaginationProvider,
          useValue: { paginateQuery: jest.fn() },
        },
      ],
    }).compile()

    service = module.get(AuditLogService)
  })

  describe('log()', () => {
    it('saves a record with the correct fields', async () => {
      await service.log(42, AuditAction.CREATE, 'Post', 7)

      expect(saveMock).toHaveBeenCalledWith({
        userId: 42,
        action: AuditAction.CREATE,
        entity: 'Post',
        entityId: 7,
      })
    })

    it('saves a record with null userId for anonymous operations', async () => {
      await service.log(null, AuditAction.CREATE, 'User', 1)

      expect(saveMock).toHaveBeenCalledWith({
        userId: null,
        action: AuditAction.CREATE,
        entity: 'User',
        entityId: 1,
      })
    })

    it('does not throw when the repository save rejects', async () => {
      saveMock.mockRejectedValueOnce(new Error('DB connection lost'))

      await expect(
        service.log(1, AuditAction.DELETE, 'User', 5),
      ).resolves.toBeUndefined()
    })
  })
})
