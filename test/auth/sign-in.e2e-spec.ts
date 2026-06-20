import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Tokens returned by a successful sign-in.
interface SignInResponse {
  accessToken: string
  refreshToken: string
}

describe('POST /auth/sign-in (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  const TEST_EMAIL = 'signin-test@example.com'
  const TEST_PASSWORD = 'Password123!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // seedUser does a direct DB insert + bcrypt — no mail service needed.
    await seedUser(dataSource, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: 'Test',
    })
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [TEST_EMAIL, 'unverified@example.com'])
    await app.close()
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it('returns 200 and issues accessToken + refreshToken for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200)

    const body = res.body as ApiResponse<SignInResponse>
    expect(body.apiVersion).toBeDefined()
    expect(body.data.accessToken).toBeTruthy()
    expect(body.data.refreshToken).toBeTruthy()
  })

  // ── Sad paths ────────────────────────────────────────────────────────────

  it('returns 401 when the password is wrong', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: TEST_EMAIL, password: 'WrongPassword!' })
      .expect(401)
  })

  it('returns 401 when the user has not verified their email', async () => {
    // Seed an unverified user to exercise that branch of SignInProvider.
    await seedUser(dataSource, {
      email: 'unverified@example.com',
      password: TEST_PASSWORD,
      firstName: 'Unverified',
      isEmailVerified: false,
    })

    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: 'unverified@example.com', password: TEST_PASSWORD })
      .expect(401)
  })

  it('returns 400 when a required field is missing', async () => {
    // The ValidationPipe rejects the request before it reaches SignInProvider.
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ password: TEST_PASSWORD }) // missing 'email'
      .expect(400)
  })

  it('getAuthToken helper returns a usable access token', async () => {
    // Smoke-test the shared helper itself.
    const token = await getAuthToken(app, TEST_EMAIL, TEST_PASSWORD)
    expect(token).toBeTruthy()
  })
})
