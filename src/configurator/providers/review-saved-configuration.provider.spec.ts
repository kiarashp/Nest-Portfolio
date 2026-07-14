import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ReviewSavedConfigurationProvider } from './review-saved-configuration.provider'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('ReviewSavedConfigurationProvider', () => {
  let provider: ReviewSavedConfigurationProvider
  let repoSave: jest.Mock
  let findOneSavedConfigurationProvider: { findOneByIdOrFail: jest.Mock }
  let auditLogService: { log: jest.Mock }

  const savedConfiguration = {
    id: 1,
    quoteReviewed: false,
  } as SavedConfiguration

  beforeEach(async () => {
    repoSave = jest
      .fn()
      .mockImplementation((entity: SavedConfiguration) =>
        Promise.resolve(entity),
      )
    findOneSavedConfigurationProvider = { findOneByIdOrFail: jest.fn() }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewSavedConfigurationProvider,
        {
          provide: getRepositoryToken(SavedConfiguration),
          useValue: { save: repoSave },
        },
        {
          provide: FindOneSavedConfigurationProvider,
          useValue: findOneSavedConfigurationProvider,
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(ReviewSavedConfigurationProvider)
  })

  it('sets the quoteReviewed flag and saves', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
      ...savedConfiguration,
    })

    const result = await provider.review(1, { quoteReviewed: true }, 5)

    expect(result.quoteReviewed).toBe(true)
    expect(repoSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, quoteReviewed: true }),
    )
  })

  it('writes an audit log entry after a successful save', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
      ...savedConfiguration,
    })

    await provider.review(1, { quoteReviewed: true }, 5)

    expect(auditLogService.log).toHaveBeenCalledWith(
      5,
      AuditAction.UPDATE,
      'SavedConfiguration',
      1,
    )
  })

  it('propagates NotFoundException from the find-one provider without saving', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockRejectedValue(
      new NotFoundException('Saved configuration 99 not found'),
    )

    await expect(
      provider.review(99, { quoteReviewed: true }, 5),
    ).rejects.toThrow(NotFoundException)
    expect(repoSave).not.toHaveBeenCalled()
    expect(auditLogService.log).not.toHaveBeenCalled()
  })
})
