import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../src/auth/enums/user-role.enum'
import { ApiResponse, getAuthToken } from './helpers/auth.helper'
import { createApp } from './helpers/create-app.helper'
import { cleanupUsers, seedUser } from './helpers/seed.helper'
import { Paginated } from '../src/common/pagination/interfaces/paginated.interface'
import { User } from '../src/users/entities/user.entity'

describe('GET /users — pagination (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string

  const ADMIN_EMAIL = 'users-list-admin@e2e.test'
  const USER_EMAIL = 'users-list-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Pre-cleanup: remove rows from a previously failed run.
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ListAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'ListUser',
      role: UserRole.USER,
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── GET /users ────────────────────────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    await request(app.getHttpServer()).get('/users').expect(401)
  })

  it('returns 403 when a USER role calls GET /users', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('returns 200 with paginated shape for ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<User>>
    expect(body.data).toHaveProperty('data')
    expect(body.data).toHaveProperty('meta')
    expect(body.data).toHaveProperty('links')
    expect(Array.isArray(body.data.data)).toBe(true)
  })

  it('respects the limit param — returns at most limit users', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?limit=1&page=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<User>>
    expect(body.data.data.length).toBeLessThanOrEqual(1)
    expect(body.data.meta.itemsPerPage).toBe(1)
    expect(body.data.meta.currentPage).toBe(1)
  })

  it('returns the second page when page=2 is provided', async () => {
    // Fetch page 1 and page 2 with limit=1 and confirm different users are returned
    // (assumes at least 2 users exist after seeding admin + user above).
    const page1 = await request(app.getHttpServer())
      .get('/users?limit=1&page=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const page2 = await request(app.getHttpServer())
      .get('/users?limit=1&page=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body1 = (page1.body as ApiResponse<Paginated<User>>).data
    const body2 = (page2.body as ApiResponse<Paginated<User>>).data

    expect(body1.meta.currentPage).toBe(1)
    expect(body2.meta.currentPage).toBe(2)
    // The IDs on the two pages must not overlap.
    const ids1 = body1.data.map((u) => u.id)
    const ids2 = body2.data.map((u) => u.id)
    const overlap = ids1.filter((id) => ids2.includes(id))
    expect(overlap).toHaveLength(0)
  })

  it('meta.totalItems reflects the real count, not a capped value', async () => {
    // Ask for all users in one page (large limit) and compare data length to totalItems.
    const res = await request(app.getHttpServer())
      .get('/users?limit=100&page=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<User>>).data
    expect(body.data.length).toBe(body.meta.totalItems)
  })
})
