import { UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { RefreshTokensProvider } from './refresh-tokens.provider'
import { GenerateTokensProvider } from './generate-tokens.provider'
import { UsersService } from 'src/users/providers/users.service'
import jwtConfig from '../config/jwt.config'
import { User } from 'src/users/entities/user.entity'
import { UserRole } from '../enums/user-role.enum'

// RefreshTokensProvider implements token rotation: the client sends a refresh
// token and gets a brand-new access + refresh pair in return.
// JwtService, UsersService, and GenerateTokensProvider are all mocked.
describe('RefreshTokensProvider', () => {
  let provider: RefreshTokensProvider
  let jwtService: { verifyAsync: jest.Mock }
  let usersService: { findOneById: jest.Mock }
  let generateTokensProvider: { generateTokens: jest.Mock }

  // Minimal JWT config — only the fields verifyAsync needs.
  const mockJwtConfig = {
    secret: 'test-secret',
    audience: 'test-audience',
    issuer: 'test-issuer',
  }

  const mockUser = {
    id: 42,
    email: 'test@example.com',
    role: UserRole.USER,
  } as User

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() }
    usersService = { findOneById: jest.fn() }
    generateTokensProvider = { generateTokens: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokensProvider,
        { provide: JwtService, useValue: jwtService },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
        { provide: GenerateTokensProvider, useValue: generateTokensProvider },
        // UsersService also needs forwardRef in production; plain mock is fine here.
        { provide: UsersService, useValue: usersService },
      ],
    }).compile()

    provider = module.get(RefreshTokensProvider)
  })

  it('throws UnauthorizedException for an invalid or expired refresh token', async () => {
    // When verifyAsync throws (expired, tampered, wrong secret), the provider
    // must reject with 401 — never reveal why the token was rejected.
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'))

    await expect(
      provider.refreshTokens({ refreshToken: 'bad-token' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid refresh token'))
  })

  it('verifies the token with the correct config options', async () => {
    // The same secret/audience/issuer used to sign the token must be used to
    // verify it, otherwise tokens from other apps would be accepted.
    jwtService.verifyAsync.mockResolvedValue({ sub: 42 })
    usersService.findOneById.mockResolvedValue(mockUser)
    generateTokensProvider.generateTokens.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    })

    await provider.refreshTokens({ refreshToken: 'valid-token' })

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
      secret: mockJwtConfig.secret,
      audience: mockJwtConfig.audience,
      issuer: mockJwtConfig.issuer,
    })
  })

  it('fetches the user from the sub claim and issues new token pair', async () => {
    // sub in the refresh token payload is the user's database ID.
    // We re-fetch the user from the DB (not just the token) so we always get
    // the latest role and can detect disabled accounts.
    jwtService.verifyAsync.mockResolvedValue({ sub: 42 })
    usersService.findOneById.mockResolvedValue(mockUser)
    generateTokensProvider.generateTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })

    const result = await provider.refreshTokens({ refreshToken: 'valid-token' })

    expect(usersService.findOneById).toHaveBeenCalledWith(42)
    expect(generateTokensProvider.generateTokens).toHaveBeenCalledWith(mockUser)
    expect(result).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
  })
})
