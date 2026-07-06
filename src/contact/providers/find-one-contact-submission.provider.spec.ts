import { NotFoundException, RequestTimeoutException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { FindOneContactSubmissionProvider } from './find-one-contact-submission.provider'
import { ContactSubmission } from '../entities/contact-submission.entity'

// FindOneContactSubmissionProvider is the single place that reads a
// submission by id.
//   findOneById       — returns null if not found (caller decides what to do)
//   findOneByIdOrFail — throws NotFoundException if not found
describe('FindOneContactSubmissionProvider', () => {
  let provider: FindOneContactSubmissionProvider
  let repo: { findOneBy: jest.Mock }

  const submission = { id: 1, name: 'Jane Doe' } as ContactSubmission

  beforeEach(async () => {
    repo = { findOneBy: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindOneContactSubmissionProvider,
        { provide: getRepositoryToken(ContactSubmission), useValue: repo },
      ],
    }).compile()

    provider = module.get(FindOneContactSubmissionProvider)
  })

  describe('findOneById', () => {
    it('returns the submission when found', async () => {
      repo.findOneBy.mockResolvedValue(submission)
      expect(await provider.findOneById(1)).toEqual(submission)
    })

    it('returns null when no submission matches the id', async () => {
      repo.findOneBy.mockResolvedValue(null)
      expect(await provider.findOneById(999)).toBeNull()
    })

    it('throws RequestTimeoutException on a database error', async () => {
      repo.findOneBy.mockRejectedValue(new Error('connection lost'))
      await expect(provider.findOneById(1)).rejects.toThrow(
        RequestTimeoutException,
      )
    })
  })

  describe('findOneByIdOrFail', () => {
    it('returns the submission when found', async () => {
      repo.findOneBy.mockResolvedValue(submission)
      expect(await provider.findOneByIdOrFail(1)).toEqual(submission)
    })

    it('throws NotFoundException when the submission does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null)
      await expect(provider.findOneByIdOrFail(99)).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
