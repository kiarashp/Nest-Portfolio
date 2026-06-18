import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { AppModule } from '../../src/app.module'
import { MailService } from '../../src/mail/mail.service'
import { User } from '../../src/users/entities/user.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('Users (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string
  let regularUserId: number
  let userToDeleteId: number

  const ADMIN_EMAIL = 'users-admin@e2e.test'
  const USER_EMAIL = 'users-user@e2e.test'
  const DELETE_USER_EMAIL = 'users-delete@e2e.test'
  const PASSWORD = 'Password1!'

  // Email used in the registration tests — must be cleaned up in afterAll.
  const REGISTER_EMAIL = 'new-user@e2e.test'

  beforeAll(async () => {
    // POST /users triggers sendVerificationMail; override with a no-op so no
    // real SMTP connection is needed and the test stays self-contained.
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationMail: jest.fn().mockResolvedValue(undefined),
        sendWelcomeMail: jest.fn().mockResolvedValue(undefined),
        sendMail: jest.fn().mockResolvedValue(undefined),
      })
      .compile()

    ;({ app, dataSource } = await createApp(moduleFixture))

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'UsersAdmin',
      role: UserRole.ADMIN,
    })

    const regularUser = await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'UsersUser',
    })
    regularUserId = regularUser.id

    const toDelete = await seedUser(dataSource, {
      email: DELETE_USER_EMAIL,
      password: PASSWORD,
      firstName: 'ToDelete',
    })
    userToDeleteId = toDelete.id

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    // DELETE_USER_EMAIL may already be gone (deleted in the DELETE test).
    await cleanupUsers(dataSource, [
      ADMIN_EMAIL,
      USER_EMAIL,
      DELETE_USER_EMAIL,
      REGISTER_EMAIL,
    ])
    await app.close()
  })

  // ── POST /users (public registration) ────────────────────────────────────

  it('POST /users → 201 and response excludes password', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ firstName: 'NewUser', email: REGISTER_EMAIL, password: PASSWORD })
      .expect(201)

    const user = (res.body as ApiResponse<User>).data
    expect(user.id).toBeDefined()
    expect(user.firstName).toBe('NewUser')
    // password must be excluded by the @Exclude() decorator on the entity.
    expect((user as Record<string, unknown>).password).toBeUndefined()
    // googleId must also be excluded.
    expect((user as Record<string, unknown>).googleId).toBeUndefined()
  })

  it('POST /users (duplicate email) → 400', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ firstName: 'Dupe', email: REGISTER_EMAIL, password: PASSWORD })
      .expect(400)
  })

  it('POST /users (missing required firstName) → 400', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'missing-name@e2e.test', password: PASSWORD })
      .expect(400)
  })

  it('POST /users (invalid email format) → 400', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ firstName: 'Bad', email: 'not-an-email', password: PASSWORD })
      .expect(400)
  })

  // ── GET /users (admin only) ───────────────────────────────────────────────

  it('GET /users (ADMIN) → 200 with user list', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(Array.isArray((res.body as ApiResponse<User[]>).data)).toBe(true)
  })

  it('GET /users (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('GET /users (no token) → 401', async () => {
    await request(app.getHttpServer()).get('/users').expect(401)
  })

  // ── GET /users/:id (admin only) ───────────────────────────────────────────

  it('GET /users/:id (ADMIN) → 200 with the user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${regularUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect((res.body as ApiResponse<User>).data.id).toBe(regularUserId)
  })

  it('GET /users/:id (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get(`/users/${regularUserId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  // ── GET /users/me (any authenticated user) ────────────────────────────────

  it('GET /users/me (USER token) → 200 with own profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)

    expect((res.body as ApiResponse<User>).data.id).toBe(regularUserId)
  })

  // ── PATCH /users/:id/role (admin only) ────────────────────────────────────

  it('PATCH /users/:id/role (ADMIN) → 200 with updated role', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${regularUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: UserRole.EDITOR })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.role).toBe(UserRole.EDITOR)
  })

  // ── DELETE /users/:id (admin only) ────────────────────────────────────────

  it('DELETE /users/:id (ADMIN) → 200 and user is gone', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/users/${userToDeleteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (res.body as ApiResponse<{ message: string }>).data.message,
    ).toContain(`${userToDeleteId}`)

    // Confirm the row is removed from the DB.
    const user = await dataSource
      .getRepository(User)
      .findOneBy({ id: userToDeleteId })
    expect(user).toBeNull()
  })
})
