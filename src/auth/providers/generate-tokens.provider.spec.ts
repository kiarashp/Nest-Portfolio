import { InternalServerErrorException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { GenerateTokensProvider } from './generate-tokens.provider'
import jwtConfig from '../config/jwt.config'
import { User } from 'src/users/entities/user.entity'
import { UserRole } from '../enums/user-role.enum'

// GenerateTokensProvider signs JWTs for authentication.
// It produces two tokens: a short-lived access token and a longer-lived refresh token.
// JwtService is mocked so tests don't need real secrets or a real JWT library call.
describe('GenerateTokensProvider', () => {
  let provider: GenerateTokensProvider
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>

  // Fake config values — these replace the real env-loaded JWT settings.
  const mockJwtConfig = {
    secret: 'test-secret',
    audience: 'test-audience',
    issuer: 'test-issuer',
    accessTokenTtl: 3600,
    refreshTokenTtl: 86400,
  }

  beforeEach(async () => {
    jwtService = { signAsync: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateTokensProvider,
        { provide: JwtService, useValue: jwtService },
        // jwtConfig.KEY is the NestJS injection token for the 'jwt' config namespace.
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
      ],
    }).compile()

    provider = module.get(GenerateTokensProvider)
  })

  describe('signToken', () => {
    it('calls signAsync with merged payload and config options', async () => {
      // signToken should spread the extra payload into { sub, ...payload }
      // and pass the secret/audience/issuer from config.
      jwtService.signAsync.mockResolvedValue('signed-token')

      const result = await provider.signToken(1, 3600, { email: 'a@b.com' })

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 1, email: 'a@b.com' },
        {
          secret: mockJwtConfig.secret,
          audience: mockJwtConfig.audience,
          issuer: mockJwtConfig.issuer,
          expiresIn: 3600,
        },
      )
      expect(result).toBe('signed-token')
    })

    it('includes only sub when no extra payload is given', async () => {
      // Refresh tokens carry only the user ID — no email or role in the payload.
      jwtService.signAsync.mockResolvedValue('refresh-token')

      await provider.signToken(42, 86400)

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 42 },
        expect.objectContaining({ expiresIn: 86400 }),
      )
    })
  })

  describe('generateTokens', () => {
    // A minimal user object — only the fields that generateTokens actually reads.
    const user = {
      id: 1,
      email: 'test@test.com',
      role: UserRole.USER,
    } as User

    it('returns both accessToken and refreshToken', async () => {
      // The two signAsync calls happen in parallel; mock them in order.
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token')

      const result = await provider.generateTokens(user)

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })
    })

    it('access token payload contains email and role', async () => {
      // The access token is the first call; it must embed email and role so
      // guards can read the user's identity without hitting the database.
      jwtService.signAsync.mockResolvedValue('token')

      await provider.generateTokens(user)

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ email: user.email, role: user.role }),
        expect.objectContaining({ expiresIn: mockJwtConfig.accessTokenTtl }),
      )
    })

    it('refresh token payload contains only sub', async () => {
      // The refresh token is the second call; it must carry only the user ID.
      // Keeping it minimal limits the damage if the token is ever leaked.
      jwtService.signAsync.mockResolvedValue('token')

      await provider.generateTokens(user)

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: user.id },
        expect.objectContaining({ expiresIn: mockJwtConfig.refreshTokenTtl }),
      )
    })

    it('throws InternalServerErrorException when signing fails', async () => {
      // If JwtService throws (e.g. bad secret config), the provider wraps the
      // error in a 500 so the caller gets a safe, generic response.
      jwtService.signAsync.mockRejectedValue(new Error('signing failed'))

      await expect(provider.generateTokens(user)).rejects.toThrow(
        InternalServerErrorException,
      )
    })
  })
})
