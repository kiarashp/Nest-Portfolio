import {
  BadRequestException,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UpdateQuoteStatusProvider } from './update-quote-status.provider'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { QuoteStatus } from '../enums/quote-status.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('UpdateQuoteStatusProvider', () => {
  let provider: UpdateQuoteStatusProvider
  let repoSave: jest.Mock
  let findOneSavedConfigurationProvider: { findOneByIdOrFail: jest.Mock }
  let auditLogService: { log: jest.Mock }

  const savedConfiguration = {
    id: 1,
    quoteRequestedAt: new Date('2026-07-01T00:00:00Z'),
    quoteStatus: QuoteStatus.PENDING,
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
        UpdateQuoteStatusProvider,
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

    provider = module.get(UpdateQuoteStatusProvider)
  })

  it('sets the quoteStatus and saves', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
      ...savedConfiguration,
    })

    const result = await provider.updateStatus(
      1,
      { quoteStatus: QuoteStatus.CLOSED },
      5,
    )

    expect(result.quoteStatus).toBe(QuoteStatus.CLOSED)
    expect(repoSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, quoteStatus: QuoteStatus.CLOSED }),
    )
  })

  it('writes an audit log entry after a successful save', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
      ...savedConfiguration,
    })

    await provider.updateStatus(1, { quoteStatus: QuoteStatus.ANSWERED }, 5)

    expect(auditLogService.log).toHaveBeenCalledWith(
      5,
      AuditAction.UPDATE,
      'SavedConfiguration',
      1,
    )
  })

  it('throws BadRequestException when no quote was ever requested', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
      ...savedConfiguration,
      quoteRequestedAt: null,
      quoteStatus: null,
    })

    await expect(
      provider.updateStatus(1, { quoteStatus: QuoteStatus.CLOSED }, 5),
    ).rejects.toThrow(BadRequestException)
    expect(repoSave).not.toHaveBeenCalled()
    expect(auditLogService.log).not.toHaveBeenCalled()
  })

  it('throws RequestTimeoutException when the save fails', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
      ...savedConfiguration,
    })
    repoSave.mockRejectedValue(new Error('db down'))

    await expect(
      provider.updateStatus(1, { quoteStatus: QuoteStatus.CLOSED }, 5),
    ).rejects.toThrow(RequestTimeoutException)
    expect(auditLogService.log).not.toHaveBeenCalled()
  })

  it('propagates NotFoundException from the find-one provider without saving', async () => {
    findOneSavedConfigurationProvider.findOneByIdOrFail.mockRejectedValue(
      new NotFoundException('Saved configuration 99 not found'),
    )

    await expect(
      provider.updateStatus(99, { quoteStatus: QuoteStatus.CLOSED }, 5),
    ).rejects.toThrow(NotFoundException)
    expect(repoSave).not.toHaveBeenCalled()
    expect(auditLogService.log).not.toHaveBeenCalled()
  })
})
