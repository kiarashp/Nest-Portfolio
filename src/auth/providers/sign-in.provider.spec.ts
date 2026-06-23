import { RequestTimeoutException, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { SignInProvider } from './sign-in.provider'
import { UsersService } from 'src/users/providers/users.service'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { GenerateTokensProvider } from './generate-tokens.provider'
import { User } from 'src/users/entities/user.entity'
import { UserRole } from '../enums/user-role.enum'

// SignInProvider handles email + password login.
// It has several distinct error branches, each tested separately below.
// All dependencies are mocked so the tests run in isolation with no DB or real hashing.
describe('SignInProvider', () => {
  let provider: SignInProvider
  let usersService: { findOneByEmail: jest.Mock }
  let hashingProvider: { comparePassword: jest.Mock }
  let generateTokensProvider: { generateTokens: jest.Mock }

  // A user that has a local password and has already verified their email.
  // This is the "happy path" user — individual tests mutate specific fields to
  // trigger each error branch.
  const verifiedUser: Partial<User> = {
    id: 1,
    email: 'test@example.com',
    password: 'hashed-password',
    isEmailVerified: true,
    role: UserRole.USER,
  }

  const signInDto = { email: 'test@example.com', password: 'Password1!' }

  beforeEach(async () => {
    // Fresh mocks before each test so state never leaks between cases.
    usersService = { findOneByEmail: jest.fn() }
    hashingProvider = { comparePassword: jest.fn() }
    generateTokensProvider = { generateTokens: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignInProvider,
        { provide: UsersService, useValue: usersService },
        { provide: HashingProvider, useValue: hashingProvider },
        { provide: GenerateTokensProvider, useValue: generateTokensProvider },
      ],
    }).compile()

    provider = module.get(SignInProvider)
  })

  it('propagates the error thrown by findOneByEmail', async () => {
    // If the DB lookup fails, SignInProvider should not swallow the error.
    usersService.findOneByEmail.mockRejectedValue(new Error('db error'))
    await expect(provider.signIn(signInDto)).rejects.toThrow('db error')
  })

  it('throws UnauthorizedException for a Google-only account (no password)', async () => {
    // Users who signed up via Google have no local password field.
    // They must use the Google OAuth flow, not email + password.
    usersService.findOneByEmail.mockResolvedValue({
      ...verifiedUser,
      password: undefined,
    })

    await expect(provider.signIn(signInDto)).rejects.toThrow(
      new UnauthorizedException('This account uses Google Sign-In'),
    )
  })

  it('throws UnauthorizedException when email has not been verified', async () => {
    // Registration sends a verification link; sign-in must be blocked until
    // the user clicks that link to prove they own the email address.
    usersService.findOneByEmail.mockResolvedValue({
      ...verifiedUser,
      isEmailVerified: false,
    })

    await expect(provider.signIn(signInDto)).rejects.toThrow(
      new UnauthorizedException(
        'Please verify your email address before signing in',
      ),
    )
  })

  it('throws RequestTimeoutException when comparePassword throws', async () => {
    // If bcrypt itself errors (e.g. corrupted hash, timeout), we surface a 408
    // rather than letting an internal error bubble up as a 500.
    usersService.findOneByEmail.mockResolvedValue(verifiedUser)
    hashingProvider.comparePassword.mockRejectedValue(new Error('bcrypt error'))

    await expect(provider.signIn(signInDto)).rejects.toThrow(
      RequestTimeoutException,
    )
  })

  it('throws UnauthorizedException when password does not match', async () => {
    // comparePassword returns false → the supplied password is wrong.
    // We give a generic "Invalid credentials" message to avoid leaking
    // whether the email exists or just the password is wrong.
    usersService.findOneByEmail.mockResolvedValue(verifiedUser)
    hashingProvider.comparePassword.mockResolvedValue(false)

    await expect(
      provider.signIn({ ...signInDto, password: 'wrong' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'))
  })

  it('returns tokens when credentials are valid', async () => {
    // Happy path: found user → verified → password matches → issue token pair.
    usersService.findOneByEmail.mockResolvedValue(verifiedUser)
    hashingProvider.comparePassword.mockResolvedValue(true)
    generateTokensProvider.generateTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    })

    const result = await provider.signIn(signInDto)

    // The whole user object must be passed to generateTokens (not just the ID)
    // because the access token payload needs email and role too.
    expect(generateTokensProvider.generateTokens).toHaveBeenCalledWith(
      verifiedUser,
    )
    expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' })
  })
})
