import { BadRequestException, RequestTimeoutException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { CreateUserProvider } from './create-user.provider'
import { User } from '../entities/user.entity'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AppEvents } from 'src/common/events/app-events'

// CreateUserProvider registers a new local user.
// The flow has three DB operations (findOne + two saves) and one mail send,
// all of which are mocked here so no real DB or SMTP server is needed.
describe('CreateUserProvider', () => {
  let provider: CreateUserProvider
  let userRepo: {
    findOne: jest.Mock
    create: jest.Mock
    save: jest.Mock
  }
  let hashingProvider: { hashPassword: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let configService: { get: jest.Mock }

  // A minimal DTO that satisfies CreateUserDto's required fields.
  const createUserDto = {
    firstName: 'John',
    email: 'john@example.com',
    password: 'Password1!',
  }

  beforeEach(async () => {
    // Each test gets fresh mocks so call counts and return values don't bleed over.
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    }
    hashingProvider = { hashPassword: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    configService = { get: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserProvider,
        // getRepositoryToken(User) is the DI token NestJS uses for the TypeORM repo.
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: HashingProvider, useValue: hashingProvider },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    provider = module.get(CreateUserProvider)
  })

  it('throws RequestTimeoutException when the DB check for existing email fails', async () => {
    // If the initial findOne query errors (e.g. DB is down), we return a 408
    // instead of a raw 500 so clients know to retry.
    userRepo.findOne.mockRejectedValue(new Error('db error'))

    await expect(provider.craeteUser(createUserDto)).rejects.toThrow(
      RequestTimeoutException,
    )
  })

  it('throws BadRequestException when the email is already taken', async () => {
    // findOne found an existing user with the same email — duplicate registration.
    userRepo.findOne.mockResolvedValue({ id: 99, email: createUserDto.email })

    await expect(provider.craeteUser(createUserDto)).rejects.toThrow(
      new BadRequestException('User already exist'),
    )
  })

  it('throws RequestTimeoutException when the initial save fails', async () => {
    // findOne returns null (email is free), but the first save blows up.
    // This tests that the try/catch around the create+save block works.
    userRepo.findOne.mockResolvedValue(null)
    hashingProvider.hashPassword.mockResolvedValue('hashed')
    userRepo.create.mockReturnValue({ ...createUserDto, password: 'hashed' })
    userRepo.save.mockRejectedValue(new Error('db error'))

    await expect(provider.craeteUser(createUserDto)).rejects.toThrow(
      RequestTimeoutException,
    )
  })

  it('throws RequestTimeoutException when the verification-token save fails', async () => {
    // The provider saves twice: once for the user row, then again to persist
    // the email verification token.  This tests the second save failing.
    const newUser = {
      ...createUserDto,
      id: 1,
      password: 'hashed',
      role: UserRole.USER,
    }
    userRepo.findOne.mockResolvedValue(null)
    hashingProvider.hashPassword.mockResolvedValue('hashed')
    userRepo.create.mockReturnValue(newUser)
    userRepo.save
      .mockResolvedValueOnce(newUser) // first save (user row) succeeds
      .mockRejectedValueOnce(new Error('db error')) // second save (token) fails

    await expect(provider.craeteUser(createUserDto)).rejects.toThrow(
      RequestTimeoutException,
    )
  })

  it('creates the user with role USER, sets the verification token, and sends verification mail', async () => {
    // Happy path: the user is created, the verification token is stored on the
    // entity, and a verification email is dispatched.
    // Using Record<string, unknown> lets the provider mutate the object freely.
    const newUser: Record<string, unknown> = {
      ...createUserDto,
      id: 1,
      password: 'hashed',
      role: UserRole.USER,
    }
    userRepo.findOne.mockResolvedValue(null)
    hashingProvider.hashPassword.mockResolvedValue('hashed')
    userRepo.create.mockReturnValue(newUser)
    userRepo.save.mockResolvedValue(newUser)
    // configService.get is called to build the verification URL.
    configService.get.mockReturnValue('http://localhost:3000')

    const result = await provider.craeteUser(createUserDto)

    // Role must always be USER — the DTO must not be able to inject a higher role.
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.USER, password: 'hashed' }),
    )
    // Two saves: initial user row + verification token fields.
    expect(userRepo.save).toHaveBeenCalledTimes(2)
    // The returned entity must have the verification flag cleared and token set.
    expect(result.isEmailVerified).toBe(false)
    expect(result.emailVerificationToken).toBeDefined()
    // The user.created event must be emitted with the user's email so the listener sends mail.
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AppEvents.USER_CREATED,
      expect.objectContaining({ email: createUserDto.email }),
    )
  })
})
