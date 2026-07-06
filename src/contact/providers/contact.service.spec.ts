import { Test, TestingModule } from '@nestjs/testing'
import { ContactService } from './contact.service'
import { SubmitContactProvider } from './submit-contact.provider'
import { FindAllContactSubmissionsProvider } from './find-all-contact-submissions.provider'
import { FindOneContactSubmissionProvider } from './find-one-contact-submission.provider'
import { UpdateContactSubmissionProvider } from './update-contact-submission.provider'
import { ContactSubmission } from '../entities/contact-submission.entity'
import type { Request } from 'express'

describe('ContactService', () => {
  let service: ContactService
  let submitContactProvider: { submit: jest.Mock }
  let findAllContactSubmissionsProvider: { findAll: jest.Mock }
  let findOneContactSubmissionProvider: { findOneByIdOrFail: jest.Mock }
  let updateContactSubmissionProvider: { update: jest.Mock }

  beforeEach(async () => {
    submitContactProvider = { submit: jest.fn() }
    findAllContactSubmissionsProvider = { findAll: jest.fn() }
    findOneContactSubmissionProvider = { findOneByIdOrFail: jest.fn() }
    updateContactSubmissionProvider = { update: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: SubmitContactProvider, useValue: submitContactProvider },
        {
          provide: FindAllContactSubmissionsProvider,
          useValue: findAllContactSubmissionsProvider,
        },
        {
          provide: FindOneContactSubmissionProvider,
          useValue: findOneContactSubmissionProvider,
        },
        {
          provide: UpdateContactSubmissionProvider,
          useValue: updateContactSubmissionProvider,
        },
      ],
    }).compile()

    service = module.get(ContactService)
  })

  it('submit → delegates to SubmitContactProvider.submit', async () => {
    const dto = {
      name: 'Jane',
      email: 'jane@example.com',
      subject: 'Hi',
      message: 'Hello',
    }
    const submission = { id: 1 } as ContactSubmission
    submitContactProvider.submit.mockResolvedValue(submission)

    const result = await service.submit(dto)

    expect(submitContactProvider.submit).toHaveBeenCalledWith(dto)
    expect(result).toBe(submission)
  })

  it('findAll → delegates to FindAllContactSubmissionsProvider.findAll', async () => {
    const dto = { limit: 10, page: 1 }
    const request = {} as Request
    const paginated = { data: [], meta: {}, links: {} }
    findAllContactSubmissionsProvider.findAll.mockResolvedValue(paginated)

    const result = await service.findAll(dto, request)

    expect(findAllContactSubmissionsProvider.findAll).toHaveBeenCalledWith(
      dto,
      request,
    )
    expect(result).toBe(paginated)
  })

  it('findOne → delegates to FindOneContactSubmissionProvider.findOneByIdOrFail', async () => {
    const submission = { id: 1 } as ContactSubmission
    findOneContactSubmissionProvider.findOneByIdOrFail.mockResolvedValue(
      submission,
    )

    const result = await service.findOne(1)

    expect(
      findOneContactSubmissionProvider.findOneByIdOrFail,
    ).toHaveBeenCalledWith(1)
    expect(result).toBe(submission)
  })

  it('update → delegates to UpdateContactSubmissionProvider.update', async () => {
    const submission = { id: 1, handled: true } as ContactSubmission
    updateContactSubmissionProvider.update.mockResolvedValue(submission)

    const result = await service.update(1, { handled: true }, 5)

    expect(updateContactSubmissionProvider.update).toHaveBeenCalledWith(
      1,
      { handled: true },
      5,
    )
    expect(result).toBe(submission)
  })
})
