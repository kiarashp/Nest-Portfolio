import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let userToken: string
  let adminToken: string
  // ID of the regular user — needed to verify ADMIN can fetch any profile by ID.
  let userId: number

  const PASSWORD = 'Password123!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Seed a regular USER and an ADMIN directly — bypasses the chicken-and-egg
    // problem of needing an existing admin to elevate roles via the API.
    const savedUser = await seedUser(dataSource, {
      email: 'rbac-user@example.com',
      password: PASSWORD,
      firstName: 'Regular',
      role: UserRole.USER,
    })
    userId = savedUser.id

    await seedUser(dataSource, {
      email: 'rbac-admin@example.com',
      password: PASSWORD,
      firstName: 'Admin',
      role: UserRole.ADMIN,
    })

    userToken = await getAuthToken(app, 'rbac-user@example.com', PASSWORD)
    adminToken = await getAuthToken(app, 'rbac-admin@example.com', PASSWORD)
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [
      'rbac-user@example.com',
      'rbac-admin@example.com',
    ])
    await app.close()
  })

  // ── Unauthenticated ──────────────────────────────────────────────────────

  it('returns 401 when no token is provided on a protected route', async () => {
    await request(app.getHttpServer()).get('/users').expect(401)
  })

  // ── Role enforcement ─────────────────────────────────────────────────────

  it('returns 403 when a USER hits an ADMIN-only route', async () => {
    // GET /users is decorated with @Roles(UserRole.ADMIN).
    // A valid token is present, so AuthenticationGuard passes, but
    // RolesGuard rejects because the role on the token is USER.
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('returns 200 when an ADMIN hits an ADMIN-only route', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
  })

  // ── Self-profile ─────────────────────────────────────────────────────────

  it('returns 200 for GET /users/me', async () => {
    // Any authenticated user can fetch their own profile via /me.
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
  })

  it('returns 403 when a USER hits GET /users/:id (admin-only)', async () => {
    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('returns 200 when an ADMIN hits GET /users/:id', async () => {
    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
  })
})
