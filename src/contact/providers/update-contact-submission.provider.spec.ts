import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UpdateContactSubmissionProvider } from './update-contact-submission.provider'
import { FindOneContactSubmissionProvider } from './find-one-contact-submission.provider'
import { ContactSubmission } from '../entities/contact-submission.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('UpdateContactSubmissionProvider', () => {
  let provider: UpdateContactSubmissionProvider
  let repoSave: jest.Mock
  let findOneContactSubmissionProvider: { findOneByIdOrFail: jest.Mock }
  let auditLogService: { log: jest.Mock }

  const submission = { id: 1, handled: false } as ContactSubmission

  beforeEach(async () => {
    repoSave = jest
      .fn()
      .mockImplementation((entity: ContactSubmission) =>
        Promise.resolve(entity),
      )
    findOneContactSubmissionProvider = { findOneByIdOrFail: jest.fn() }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateContactSubmissionProvider,
        {
          provide: getRepositoryToken(ContactSubmission),
          useValue: { save: repoSave },
        },
        {
          provide: FindOneContactSubmissionProvider,
          useValue: findOneContactSubmissionProvider,
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(UpdateContactSubmissionProvider)
  })

  it('sets the handled flag and saves', async () => {
    findOneContactSubmissionProvider.findOneByIdOrFail.mockResolvedValue({
      ...submission,
    })

    const result = await provider.update(1, { handled: true }, 5)

    expect(result.handled).toBe(true)
    expect(repoSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, handled: true }),
    )
  })

  it('writes an audit log entry after a successful save', async () => {
    findOneContactSubmissionProvider.findOneByIdOrFail.mockResolvedValue({
      ...submission,
    })

    await provider.update(1, { handled: true }, 5)

    expect(auditLogService.log).toHaveBeenCalledWith(
      5,
      AuditAction.UPDATE,
      'ContactSubmission',
      1,
    )
  })

  it('propagates NotFoundException from the find-one provider without saving', async () => {
    findOneContactSubmissionProvider.findOneByIdOrFail.mockRejectedValue(
      new NotFoundException('Contact submission with ID 99 not found'),
    )

    await expect(provider.update(99, { handled: true }, 5)).rejects.toThrow(
      NotFoundException,
    )
    expect(repoSave).not.toHaveBeenCalled()
    expect(auditLogService.log).not.toHaveBeenCalled()
  })
})
