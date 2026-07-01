import { BadRequestException, RequestTimeoutException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AdminCreateUserProvider } from './admin-create-user.provider'
import { User } from '../entities/user.entity'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AppEvents } from 'src/common/events/app-events'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

// AdminCreateUserProvider lets an admin create a user with an explicit role
// and verification status. The repository, hashing, event emitter, config,
// and audit log dependencies are all mocked so no real DB or SMTP is needed.
describe('AdminCreateUserProvider', () => {
  let provider: AdminCreateUserProvider
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock }
  let hashingProvider: { hashPassword: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let configService: { get: jest.Mock }
  let auditLogService: { log: jest.Mock }

  const adminCreateUserDto = {
    firstName: 'John',
    email: 'john@example.com',
    password: 'Password1!',
  }

  beforeEach(async () => {
    userRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() }
    hashingProvider = { hashPassword: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    configService = { get: jest.fn() }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCreateUserProvider,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: HashingProvider, useValue: hashingProvider },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: configService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(AdminCreateUserProvider)
  })

  it('throws BadRequestException when the email is already taken', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 99,
      email: adminCreateUserDto.email,
    })

    await expect(
      provider.adminCreateUser(adminCreateUserDto, 1),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws RequestTimeoutException when the initial save fails', async () => {
    userRepo.findOne.mockResolvedValue(null)
    hashingProvider.hashPassword.mockResolvedValue('hashed')
    userRepo.create.mockReturnValue({
      ...adminCreateUserDto,
      password: 'hashed',
    })
    userRepo.save.mockRejectedValue(new Error('db error'))

    await expect(
      provider.adminCreateUser(adminCreateUserDto, 1),
    ).rejects.toThrow(RequestTimeoutException)
  })

  it('defaults role to USER when omitted and creates the user pre-verified without emitting an event', async () => {
    const newUser: Record<string, unknown> = {
      ...adminCreateUserDto,
      id: 1,
      password: 'hashed',
      role: UserRole.USER,
      isEmailVerified: true,
    }
    userRepo.findOne.mockResolvedValue(null)
    hashingProvider.hashPassword.mockResolvedValue('hashed')
    userRepo.create.mockReturnValue(newUser)
    userRepo.save.mockResolvedValue(newUser)

    const result = await provider.adminCreateUser(
      { ...adminCreateUserDto, isEmailVerified: true },
      7,
    )

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.USER,
        isEmailVerified: true,
        password: 'hashed',
      }),
    )
    // Only one save — no verification token round trip needed.
    expect(userRepo.save).toHaveBeenCalledTimes(1)
    expect(eventEmitter.emit).not.toHaveBeenCalled()
    expect(auditLogService.log).toHaveBeenCalledWith(
      7,
      AuditAction.CREATE,
      'User',
      1,
    )
    expect(result.isEmailVerified).toBe(true)
  })

  it('uses the given role and generates a verification token + emits the event when left unverified', async () => {
    const newUser: Record<string, unknown> = {
      ...adminCreateUserDto,
      id: 2,
      password: 'hashed',
      role: UserRole.EDITOR,
      isEmailVerified: false,
    }
    userRepo.findOne.mockResolvedValue(null)
    hashingProvider.hashPassword.mockResolvedValue('hashed')
    userRepo.create.mockReturnValue(newUser)
    userRepo.save.mockResolvedValue(newUser)
    configService.get.mockReturnValue('http://localhost:3000')

    const result = await provider.adminCreateUser(
      { ...adminCreateUserDto, role: UserRole.EDITOR },
      7,
    )

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.EDITOR,
        isEmailVerified: false,
      }),
    )
    // Two saves: initial user row + verification token fields.
    expect(userRepo.save).toHaveBeenCalledTimes(2)
    expect(result.emailVerificationToken).toBeDefined()
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AppEvents.USER_CREATED,
      expect.objectContaining({ email: adminCreateUserDto.email }),
    )
    expect(auditLogService.log).toHaveBeenCalledWith(
      7,
      AuditAction.CREATE,
      'User',
      2,
    )
  })
})
