import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { User } from '../../src/users/entities/user.entity'
import { Paginated } from '../../src/common/pagination/interfaces/paginated.interface'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('Users (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string
  let adminUserId: number
  let regularUserId: number
  let userToDeleteId: number
  let patchTargetId: number
  let verifyTargetId: number

  const ADMIN_EMAIL = 'users-admin@e2e.test'
  const USER_EMAIL = 'users-user@e2e.test'
  const DELETE_USER_EMAIL = 'users-delete@e2e.test'
  const PASSWORD = 'Password1!'

  // Email used in the registration tests — must be cleaned up in afterAll.
  const REGISTER_EMAIL = 'new-user@e2e.test'
  // User targeted by admin PATCH tests; second constant tracks the updated email.
  const PATCH_TARGET_EMAIL = 'users-patch@e2e.test'
  const PATCH_TARGET_UPDATED_EMAIL = 'users-patch-updated@e2e.test'
  // User targeted by the admin verify-email toggle tests — seeded unverified.
  const VERIFY_TARGET_EMAIL = 'users-verify-target@e2e.test'
  // Emails used by the POST /users/admin tests.
  const ADMIN_CREATED_VERIFIED_EMAIL = 'users-admin-created-verified@e2e.test'
  const ADMIN_CREATED_UNVERIFIED_EMAIL =
    'users-admin-created-unverified@e2e.test'

  const sendVerificationMailMock = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp({
      mailMock: { sendVerificationMail: sendVerificationMailMock },
    }))

    const admin = await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'UsersAdmin',
      role: UserRole.ADMIN,
    })
    adminUserId = admin.id

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

    const patchTarget = await seedUser(dataSource, {
      email: PATCH_TARGET_EMAIL,
      password: PASSWORD,
      firstName: 'PatchTarget',
    })
    patchTargetId = patchTarget.id

    const verifyTarget = await seedUser(dataSource, {
      email: VERIFY_TARGET_EMAIL,
      password: PASSWORD,
      firstName: 'VerifyTarget',
      isEmailVerified: false,
    })
    verifyTargetId = verifyTarget.id

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    // DELETE_USER_EMAIL may already be gone (deleted in the DELETE test).
    // PATCH_TARGET_UPDATED_EMAIL covers the row after the admin email-update test.
    await cleanupUsers(dataSource, [
      ADMIN_EMAIL,
      USER_EMAIL,
      DELETE_USER_EMAIL,
      REGISTER_EMAIL,
      PATCH_TARGET_EMAIL,
      PATCH_TARGET_UPDATED_EMAIL,
      VERIFY_TARGET_EMAIL,
      ADMIN_CREATED_VERIFIED_EMAIL,
      ADMIN_CREATED_UNVERIFIED_EMAIL,
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
    expect(
      (user as unknown as Record<string, unknown>).password,
    ).toBeUndefined()
    // googleId must also be excluded.
    expect(
      (user as unknown as Record<string, unknown>).googleId,
    ).toBeUndefined()
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

  // ── POST /users/admin (admin only) ────────────────────────────────────────

  it('POST /users/admin (ADMIN, isEmailVerified: true) → 201, pre-verified, no verification email sent', async () => {
    sendVerificationMailMock.mockClear()

    const res = await request(app.getHttpServer())
      .post('/users/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'AdminCreatedVerified',
        email: ADMIN_CREATED_VERIFIED_EMAIL,
        password: PASSWORD,
        role: UserRole.EDITOR,
        isEmailVerified: true,
      })
      .expect(201)

    const user = res.body as ApiResponse<User>
    expect(user.data.role).toBe(UserRole.EDITOR)
    expect(user.data.isEmailVerified).toBe(true)
    expect(sendVerificationMailMock).not.toHaveBeenCalled()

    // A pre-verified admin-created user can sign in immediately.
    await getAuthToken(app, ADMIN_CREATED_VERIFIED_EMAIL, PASSWORD)
  })

  it('POST /users/admin (ADMIN, isEmailVerified omitted) → 201, unverified, verification email sent', async () => {
    sendVerificationMailMock.mockClear()

    const res = await request(app.getHttpServer())
      .post('/users/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'AdminCreatedUnverified',
        email: ADMIN_CREATED_UNVERIFIED_EMAIL,
        password: PASSWORD,
      })
      .expect(201)

    const user = res.body as ApiResponse<User>
    expect(user.data.role).toBe(UserRole.USER)
    expect(user.data.isEmailVerified).toBe(false)
    expect(sendVerificationMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: ADMIN_CREATED_UNVERIFIED_EMAIL }),
    )
  })

  it('POST /users/admin (duplicate email) → 400', async () => {
    await request(app.getHttpServer())
      .post('/users/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Dupe',
        email: ADMIN_CREATED_VERIFIED_EMAIL,
        password: PASSWORD,
      })
      .expect(400)
  })

  it('POST /users/admin (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post('/users/admin')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        firstName: 'Hack',
        email: 'users-admin-create-hack@e2e.test',
        password: PASSWORD,
      })
      .expect(403)
  })

  // ── GET /users (admin only) ───────────────────────────────────────────────

  it('GET /users (ADMIN) → 200 with user list', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<User>>).data
    expect(Array.isArray(body.data)).toBe(true)
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

  // ── PATCH /users/me (any authenticated user) ─────────────────────────────

  it('PATCH /users/me → 200 updates own firstName', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ firstName: 'Updated' })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.firstName).toBe('Updated')
  })

  it('PATCH /users/me → 200 updates own lastName', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lastName: 'Smith' })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.lastName).toBe('Smith')
  })

  it('PATCH /users/me (email field in body) → 400 forbidden property', async () => {
    // PatchUserProfileDto only allows firstName/lastName; email is not whitelisted.
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ email: 'takeover@e2e.test' })
      .expect(400)
  })

  it('PATCH /users/me (no token) → 401', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ firstName: 'X' })
      .expect(401)
  })

  // ── PATCH /users/:id (admin only) ────────────────────────────────────────

  it('PATCH /users/:id (ADMIN) → 200 updates firstName', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${patchTargetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Changed' })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.firstName).toBe('Changed')
  })

  it('PATCH /users/:id (ADMIN) → 200 updates email', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${patchTargetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: PATCH_TARGET_UPDATED_EMAIL })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.email).toBe(
      PATCH_TARGET_UPDATED_EMAIL,
    )
  })

  it('PATCH /users/:id (ADMIN, email already taken) → 400', async () => {
    // USER_EMAIL already exists; the provider must reject the duplicate.
    await request(app.getHttpServer())
      .patch(`/users/${patchTargetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: USER_EMAIL })
      .expect(400)
  })

  it('PATCH /users/:id (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${patchTargetId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ firstName: 'Hack' })
      .expect(403)
  })

  it('PATCH /users/:id (non-existent id) → 404', async () => {
    await request(app.getHttpServer())
      .patch('/users/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Ghost' })
      .expect(404)
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

  it('PATCH /users/:id/role (ADMIN targets own account) → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${adminUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: UserRole.EDITOR })
      .expect(403)
  })

  // ── PATCH /users/:id/verify-email (admin only) ────────────────────────────

  it('PATCH /users/:id/verify-email (ADMIN, true) → 200 marks the user verified', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${verifyTargetId}/verify-email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isEmailVerified: true })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.isEmailVerified).toBe(true)
  })

  it('PATCH /users/:id/verify-email (ADMIN, false) → 200 un-verifies the user', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${verifyTargetId}/verify-email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isEmailVerified: false })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.isEmailVerified).toBe(false)
  })

  it('PATCH /users/:id/verify-email (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${verifyTargetId}/verify-email`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isEmailVerified: true })
      .expect(403)
  })

  it('PATCH /users/:id/verify-email (non-existent id) → 404', async () => {
    await request(app.getHttpServer())
      .patch('/users/999999/verify-email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isEmailVerified: true })
      .expect(404)
  })

  it('PATCH /users/:id/verify-email (ADMIN targets own account) → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${adminUserId}/verify-email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isEmailVerified: false })
      .expect(403)
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

  it('DELETE /users/:id (ADMIN targets own account) → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)
  })
})
