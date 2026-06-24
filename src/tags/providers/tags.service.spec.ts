import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Tag } from '../entities/tag.entity'
import { TagsService } from './tags.service'
import { UpdateTagProvider } from './update-tag.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'

describe('TagsService', () => {
  let service: TagsService
  let repoFind: jest.Mock

  beforeEach(async () => {
    repoFind = jest.fn().mockResolvedValue([])

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: getRepositoryToken(Tag),
          useValue: {
            find: repoFind,
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        // UpdateTagProvider is not exercised here — stub it out.
        { provide: UpdateTagProvider, useValue: { update: jest.fn() } },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile()

    service = module.get(TagsService)
  })

  // ── findAll ───────────────────────────────────────────────────────────────

  it('findAll → calls repository.find with take: 200', async () => {
    await service.findAll()
    expect(repoFind).toHaveBeenCalledWith({ take: 200 })
  })

  it('findAll → returns whatever the repository returns', async () => {
    const tags = [
      { id: 1, name: 'ts' },
      { id: 2, name: 'nest' },
    ] as Tag[]
    repoFind.mockResolvedValueOnce(tags)
    const result = await service.findAll()
    expect(result).toBe(tags)
  })
})
