import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { User } from '../../src/users/entities/user.entity'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { ApiResponse } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

const EMAIL = 'password-reset-user@e2e.test'
const GOOGLE_EMAIL = 'password-reset-google@e2e.test'
const PASSWORD = 'Password123!'
const NEW_PASSWORD = 'NewPassword456!'

describe('Password Reset Flow (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let sendPasswordResetMailMock: jest.Mock
  let userId: number

  beforeAll(async () => {
    sendPasswordResetMailMock = jest.fn().mockResolvedValue(undefined)

    // Pass the tracked mock so call assertions work per-test via beforeEach.
    // ThrottlerStorage is mocked by default (skipThrottle: true) so the many
    // forgot-password calls in this suite never trigger 429.
    ;({ app, dataSource } = await createApp({
      mailMock: { sendPasswordResetMail: sendPasswordResetMailMock },
    }))

    // Pre-cleanup to avoid unique-constraint conflicts on re-runs
    await cleanupUsers(dataSource, [EMAIL, GOOGLE_EMAIL])

    const user = await seedUser(dataSource, {
      email: EMAIL,
      password: PASSWORD,
    })
    userId = user.id

    // Seed a Google-only account (no password field) to test enumeration protection
    const userRepo = dataSource.getRepository(User)
    await userRepo.save({
      firstName: 'Google',
      email: GOOGLE_EMAIL,
      isEmailVerified: true,
      role: UserRole.USER,
    })
  })

  beforeEach(() => {
    // Reset call history before each test so assertions are per-test
    sendPasswordResetMailMock.mockClear()
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [EMAIL, GOOGLE_EMAIL])
    await app.close()
  })

  // ── POST /auth/forgot-password ────────────────────────────────────────────

  it('POST /auth/forgot-password → 200 and sends reset email for a registered address', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(200)

    const body = res.body as ApiResponse<{ message: string }>
    expect(body.data.message).toContain('If that email is registered')
    expect(sendPasswordResetMailMock).toHaveBeenCalledTimes(1)
    expect(sendPasswordResetMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL }),
    )
  })

  it('POST /auth/forgot-password → 200 with same message for an unknown email (no enumeration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nobody@e2e.test' })
      .expect(200)

    const body = res.body as ApiResponse<{ message: string }>
    expect(body.data.message).toContain('If that email is registered')
    // Mail must NOT be sent — an attacker cannot tell the email is unregistered
    expect(sendPasswordResetMailMock).toHaveBeenCalledTimes(0)
  })

  it('POST /auth/forgot-password → 200 with same message for a Google-only account', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: GOOGLE_EMAIL })
      .expect(200)

    const body = res.body as ApiResponse<{ message: string }>
    expect(body.data.message).toContain('If that email is registered')
    // Google-only accounts have no password, so no reset email is sent
    expect(sendPasswordResetMailMock).toHaveBeenCalledTimes(0)
  })

  it('POST /auth/forgot-password → 400 when email is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({})
      .expect(400)
  })

  it('POST /auth/forgot-password → 400 when email format is invalid', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400)
  })

  // ── POST /auth/reset-password ─────────────────────────────────────────────

  it('POST /auth/reset-password → 200, new password works, old password rejected', async () => {
    // Trigger forgot-password so a real token is stored in the DB
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(200)

    // Read the token directly from the DB (it is excluded from HTTP responses)
    const userRepo = dataSource.getRepository(User)
    const user: User | null = await userRepo.findOneBy({ id: userId })

    const token: string = user!.passwordResetToken!

    // Reset the password
    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(200)

    expect((res.body as ApiResponse<{ message: string }>).data.message).toBe(
      'Password reset successfully',
    )

    // Old password must no longer work
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(401)

    // New password must work
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: EMAIL, password: NEW_PASSWORD })
      .expect(200)

    // Restore the original password so other tests are not affected
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(200)

    const refreshed: User | null = await userRepo.findOneBy({ id: userId })

    const restoreToken = refreshed!.passwordResetToken!

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: restoreToken, newPassword: PASSWORD })
      .expect(200)
  })

  it('POST /auth/reset-password → 400 for an invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'this-is-not-a-real-token', newPassword: NEW_PASSWORD })
      .expect(400)
  })

  it('POST /auth/reset-password → 400 for an expired token', async () => {
    // Plant an expired token directly in the DB
    const userRepo = dataSource.getRepository(User)
    await userRepo.update(userId, {
      passwordResetToken: 'expired-token-abc',
      passwordResetTokenExpiry: new Date(Date.now() - 1000),
    })

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'expired-token-abc', newPassword: NEW_PASSWORD })
      .expect(400)

    // Clean up the expired token so it does not interfere with other tests
    await userRepo.update(userId, {
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    })
  })

  it('POST /auth/reset-password → 400 when newPassword is shorter than 8 characters', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'any-token', newPassword: 'short' })
      .expect(400)
  })

  it('POST /auth/reset-password → 400 when token is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ newPassword: NEW_PASSWORD })
      .expect(400)
  })

  it('POST /auth/reset-password → 400 when newPassword is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'any-token' })
      .expect(400)
  })
})
