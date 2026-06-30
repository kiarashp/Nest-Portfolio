import { ApiProperty } from '@nestjs/swagger'

/**
 * Token pair returned by sign-in, token refresh, and Google authentication.
 * Documents the runtime shape from `src/auth/interfaces/generated-tokens.ts` so
 * the generated OpenAPI types expose it instead of leaving it untyped. The
 * refresh token is also delivered as an HttpOnly cookie for browser clients.
 */
export class AuthTokensDto {
  // Short-lived JWT used as the Bearer token on subsequent requests.
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string

  // Long-lived JWT used to obtain a new access token via POST /auth/refresh-tokens.
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string
}
