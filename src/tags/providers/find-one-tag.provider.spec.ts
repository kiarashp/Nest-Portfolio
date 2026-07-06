import { NotFoundException, RequestTimeoutException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { FindOneTagProvider } from './find-one-tag.provider'
import { Tag } from '../entities/tag.entity'

// FindOneTagProvider is the single place that reads a tag by id.
//   findOneById       — returns null if not found (caller decides what to do)
//   findOneByIdOrFail — throws NotFoundException if not found
describe('FindOneTagProvider', () => {
  let provider: FindOneTagProvider
  let tagsRepo: { findOneBy: jest.Mock }

  const tag = { id: 1, name: 'TypeScript', slug: 'typescript' } as Tag

  beforeEach(async () => {
    tagsRepo = { findOneBy: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindOneTagProvider,
        { provide: getRepositoryToken(Tag), useValue: tagsRepo },
      ],
    }).compile()

    provider = module.get(FindOneTagProvider)
  })

  // ── findOneById ───────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('returns the tag when found', async () => {
      tagsRepo.findOneBy.mockResolvedValue(tag)
      expect(await provider.findOneById(1)).toEqual(tag)
    })

    it('returns null when no tag matches the id', async () => {
      tagsRepo.findOneBy.mockResolvedValue(null)
      expect(await provider.findOneById(999)).toBeNull()
    })

    it('throws RequestTimeoutException on a database error', async () => {
      tagsRepo.findOneBy.mockRejectedValue(new Error('connection lost'))
      await expect(provider.findOneById(1)).rejects.toThrow(
        RequestTimeoutException,
      )
    })
  })

  // ── findOneByIdOrFail ─────────────────────────────────────────────────────

  describe('findOneByIdOrFail', () => {
    it('returns the tag when found', async () => {
      tagsRepo.findOneBy.mockResolvedValue(tag)
      expect(await provider.findOneByIdOrFail(1)).toEqual(tag)
    })

    it('throws NotFoundException when the tag does not exist', async () => {
      tagsRepo.findOneBy.mockResolvedValue(null)
      await expect(provider.findOneByIdOrFail(99)).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
