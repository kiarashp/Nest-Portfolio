import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module'
import { ApiResponse } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

interface TokensResponse {
  accessToken: string
  refreshToken: string
}

describe('POST /auth/refresh-tokens (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  // Captured in beforeAll by performing a real sign-in.
  let validRefreshToken: string

  const TEST_EMAIL = 'refresh-test@example.com'
  const TEST_PASSWORD = 'Password123!'

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    ;({ app, dataSource } = await createApp(moduleFixture))

    await seedUser(dataSource, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: 'Refresh',
    })

    // Sign in via HTTP to obtain a real refresh token issued by the app.
    // We want the token the actual JwtService produces, not one we manufactured.
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    validRefreshToken = (res.body as ApiResponse<TokensResponse>).data
      .refreshToken
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [TEST_EMAIL])
    await app.close()
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it('returns 200 and issues a new token pair for a valid refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({ refreshToken: validRefreshToken })
      .expect(200)

    const body = res.body as ApiResponse<TokensResponse>
    // Both tokens must be present and non-empty strings.
    expect(body.data.accessToken).toBeTruthy()
    expect(body.data.refreshToken).toBeTruthy()
  })

  // ── Sad paths ────────────────────────────────────────────────────────────

  it('returns 401 for an invalid refresh token', async () => {
    // A properly-formatted JWT (passes @IsJWT() DTO validation) but with a
    // wrong signature — verification fails in the service, returning 401.
    await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjF9.invalidsignatureXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      })
      .expect(401)
  })

  it('returns 401 when the refreshToken field is missing', async () => {
    // The DTO field is optional so the ValidationPipe passes the request through.
    // The controller enforces that at least one token source (body or cookie) is
    // present and throws UnauthorizedException when neither is provided.
    await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({})
      .expect(401)
  })
})
