import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { User } from '../../src/users/entities/user.entity'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'
import { GenerateTokensProvider } from '../../src/auth/providers/generate-tokens.provider'

const EMAIL = 'change-pw-user@e2e.test'
const GOOGLE_EMAIL = 'change-pw-google@e2e.test'
const PASSWORD = 'Password123!'
const NEW_PASSWORD = 'NewPassword456!'

describe('Change Password (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let token: string
  let googleToken: string

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Pre-cleanup to avoid unique-constraint conflicts on re-runs
    await cleanupUsers(dataSource, [EMAIL, GOOGLE_EMAIL])

    // Local user — signs in normally
    await seedUser(dataSource, { email: EMAIL, password: PASSWORD })
    token = await getAuthToken(app, EMAIL, PASSWORD)

    // Google-only user — no local password; mint a token via the provider directly
    const userRepo = dataSource.getRepository(User)
    const googleUser: User = await userRepo.save({
      firstName: 'Google',
      email: GOOGLE_EMAIL,
      isEmailVerified: true,
      role: UserRole.USER,
      // password intentionally omitted — this is a Google-only account
    })
    const generateTokens = app.get(GenerateTokensProvider)
    const tokens = await generateTokens.generateTokens(googleUser)
    googleToken = tokens.accessToken
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [EMAIL, GOOGLE_EMAIL])
    await app.close()
  })

  // ── POST /auth/change-password ────────────────────────────────────────────

  it('POST /auth/change-password → 401 when no bearer token is provided', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(401)
  })

  it('POST /auth/change-password → 400 when newPassword is shorter than 8 chars', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'short' })
      .expect(400)
  })

  it('POST /auth/change-password → 401 when currentPassword is wrong', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword!', newPassword: NEW_PASSWORD })
      .expect(401)
  })

  it('POST /auth/change-password → 400 for a Google-only account', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${googleToken}`)
      .send({ currentPassword: 'anything', newPassword: NEW_PASSWORD })
      .expect(400)
  })

  it('POST /auth/change-password → 200 with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200)

    expect((res.body as ApiResponse<{ message: string }>).data.message).toBe(
      'Password changed successfully',
    )
  })

  it('POST /auth/sign-in with new password succeeds after change', async () => {
    // Confirms the hashed password was actually persisted to the DB
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: EMAIL, password: NEW_PASSWORD })
      .expect(200)

    // Old password must no longer work
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(401)
  })
})
