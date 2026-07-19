import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { CreateQuoteMessageProvider } from './create-quote-message.provider'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { QuoteMessage } from '../entities/quote-message.entity'
import { QuoteMessageSenderRole } from '../enums/quote-message-sender-role.enum'
import { QuoteStatus } from '../enums/quote-status.enum'
import { User } from 'src/users/entities/user.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { AppEvents } from 'src/common/events/app-events'

describe('CreateQuoteMessageProvider', () => {
  let provider: CreateQuoteMessageProvider
  let messageCreate: jest.Mock
  let messageSave: jest.Mock
  let parentSave: jest.Mock
  let userFindOneBy: jest.Mock
  let findOneSavedConfigurationProvider: {
    findOneOwnedOrFail: jest.Mock
    findOneByIdOrFail: jest.Mock
  }
  let auditLogService: { log: jest.Mock }
  let eventEmitter: { emit: jest.Mock }

  const baseSavedConfiguration = {
    id: 1,
    userId: 7,
    productName: 'Resistive sensor with cap',
    code: 'FRH-2d-no-00-000-0450',
    quoteRequestedAt: new Date('2026-07-01T00:00:00Z'),
    quoteStatus: QuoteStatus.PENDING,
  } as SavedConfiguration

  const owner = {
    id: 7,
    email: 'owner@example.com',
    firstName: 'Owen',
  } as User

  beforeEach(async () => {
    messageCreate = jest
      .fn()
      .mockImplementation((partial: Partial<QuoteMessage>) => partial)
    messageSave = jest
      .fn()
      .mockImplementation((entity: Partial<QuoteMessage>) =>
        Promise.resolve({ ...entity, id: 42, createdAt: new Date() }),
      )
    parentSave = jest
      .fn()
      .mockImplementation((entity: SavedConfiguration) =>
        Promise.resolve(entity),
      )
    userFindOneBy = jest.fn().mockResolvedValue(owner)
    findOneSavedConfigurationProvider = {
      findOneOwnedOrFail: jest.fn(),
      findOneByIdOrFail: jest.fn(),
    }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }
    eventEmitter = { emit: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuoteMessageProvider,
        {
          provide: getRepositoryToken(QuoteMessage),
          useValue: { create: messageCreate, save: messageSave },
        },
        {
          provide: getRepositoryToken(SavedConfiguration),
          useValue: { save: parentSave },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOneBy: userFindOneBy },
        },
        {
          provide: FindOneSavedConfigurationProvider,
          useValue: findOneSavedConfigurationProvider,
        },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile()

    provider = module.get(CreateQuoteMessageProvider)
  })

  describe('createForOwner', () => {
    it('throws BadRequestException when no quote was ever requested', async () => {
      findOneSavedConfigurationProvider.findOneOwnedOrFail.mockResolvedValue({
        ...baseSavedConfiguration,
        quoteRequestedAt: null,
        quoteStatus: null,
      })

      await expect(
        provider.createForOwner(1, 7, { body: 'hello' }),
      ).rejects.toThrow(BadRequestException)
      expect(messageSave).not.toHaveBeenCalled()
      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })

    it('saves the message with senderRole user and the caller as sender', async () => {
      findOneSavedConfigurationProvider.findOneOwnedOrFail.mockResolvedValue({
        ...baseSavedConfiguration,
      })

      const result = await provider.createForOwner(1, 7, { body: 'hello' })

      expect(messageSave).toHaveBeenCalledWith(
        expect.objectContaining({
          savedConfigurationId: 1,
          senderId: 7,
          senderRole: QuoteMessageSenderRole.USER,
          body: 'hello',
        }),
      )
      expect(result.id).toBe(42)
    })

    it.each([QuoteStatus.ANSWERED, QuoteStatus.CLOSED])(
      'reopens a %s thread back to PENDING',
      async (status) => {
        findOneSavedConfigurationProvider.findOneOwnedOrFail.mockResolvedValue({
          ...baseSavedConfiguration,
          quoteStatus: status,
        })

        await provider.createForOwner(1, 7, { body: 'hello' })

        expect(parentSave).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, quoteStatus: QuoteStatus.PENDING }),
        )
      },
    )

    it('does not save the parent when the status is already PENDING', async () => {
      findOneSavedConfigurationProvider.findOneOwnedOrFail.mockResolvedValue({
        ...baseSavedConfiguration,
      })

      await provider.createForOwner(1, 7, { body: 'hello' })

      expect(parentSave).not.toHaveBeenCalled()
    })

    it('audit-logs a QuoteMessage CREATE with the message id', async () => {
      findOneSavedConfigurationProvider.findOneOwnedOrFail.mockResolvedValue({
        ...baseSavedConfiguration,
      })

      await provider.createForOwner(1, 7, { body: 'hello' })

      expect(auditLogService.log).toHaveBeenCalledWith(
        7,
        AuditAction.CREATE,
        'QuoteMessage',
        42,
      )
    })

    it('emits the posted-by-user event with the owner identity and message body', async () => {
      findOneSavedConfigurationProvider.findOneOwnedOrFail.mockResolvedValue({
        ...baseSavedConfiguration,
      })

      await provider.createForOwner(1, 7, { body: 'hello' })

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AppEvents.QUOTE_MESSAGE_POSTED_BY_USER,
        {
          savedConfigurationId: 1,
          userEmail: 'owner@example.com',
          userFirstName: 'Owen',
          productName: baseSavedConfiguration.productName,
          code: baseSavedConfiguration.code,
          messageBody: 'hello',
        },
      )
    })

    it('propagates NotFoundException from the owner-scoped lookup', async () => {
      findOneSavedConfigurationProvider.findOneOwnedOrFail.mockRejectedValue(
        new NotFoundException('Saved configuration 99 not found'),
      )

      await expect(
        provider.createForOwner(99, 7, { body: 'hello' }),
      ).rejects.toThrow(NotFoundException)
      expect(messageSave).not.toHaveBeenCalled()
    })
  })

  describe('createForAdmin', () => {
    const withUser = {
      ...baseSavedConfiguration,
      user: owner,
    }

    it('throws BadRequestException when no quote was ever requested', async () => {
      findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
        ...withUser,
        quoteRequestedAt: null,
        quoteStatus: null,
      })

      await expect(
        provider.createForAdmin(1, { body: 'reply' }, 5),
      ).rejects.toThrow(BadRequestException)
      expect(messageSave).not.toHaveBeenCalled()
    })

    it('saves the message with senderRole admin and bumps PENDING to ANSWERED', async () => {
      findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
        ...withUser,
      })

      await provider.createForAdmin(1, { body: 'reply' }, 5)

      expect(messageSave).toHaveBeenCalledWith(
        expect.objectContaining({
          savedConfigurationId: 1,
          senderId: 5,
          senderRole: QuoteMessageSenderRole.ADMIN,
          body: 'reply',
        }),
      )
      expect(parentSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, quoteStatus: QuoteStatus.ANSWERED }),
      )
    })

    it('leaves a CLOSED thread closed', async () => {
      findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
        ...withUser,
        quoteStatus: QuoteStatus.CLOSED,
      })

      await provider.createForAdmin(1, { body: 'reply' }, 5)

      expect(parentSave).not.toHaveBeenCalled()
    })

    it('emits the posted-by-admin event with the owner email from the loaded relation', async () => {
      findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
        ...withUser,
      })

      await provider.createForAdmin(1, { body: 'reply' }, 5)

      // no extra user lookup — the admin read already loads the relation
      expect(userFindOneBy).not.toHaveBeenCalled()
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AppEvents.QUOTE_MESSAGE_POSTED_BY_ADMIN,
        expect.objectContaining({
          userEmail: 'owner@example.com',
          userFirstName: 'Owen',
          messageBody: 'reply',
        }),
      )
    })

    it('audit-logs a QuoteMessage CREATE with the acting admin id', async () => {
      findOneSavedConfigurationProvider.findOneByIdOrFail.mockResolvedValue({
        ...withUser,
      })

      await provider.createForAdmin(1, { body: 'reply' }, 5)

      expect(auditLogService.log).toHaveBeenCalledWith(
        5,
        AuditAction.CREATE,
        'QuoteMessage',
        42,
      )
    })
  })
})
