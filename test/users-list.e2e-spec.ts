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

  // Distinctly-named users for the search/filter/sort section below — the
  // firstName prefix is unique enough that a `q` search scopes results to
  // only these rows, even though `user` is a table shared by parallel suites.
  const SEARCH_EMAIL_A = 'users-list-search-a@e2e.test'
  const SEARCH_EMAIL_B = 'users-list-search-b@e2e.test'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Pre-cleanup: remove rows from a previously failed run.
    await cleanupUsers(dataSource, [
      ADMIN_EMAIL,
      USER_EMAIL,
      SEARCH_EMAIL_A,
      SEARCH_EMAIL_B,
    ])

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
    await seedUser(dataSource, {
      email: SEARCH_EMAIL_A,
      password: PASSWORD,
      firstName: 'Zephyrine-A',
      role: UserRole.EDITOR,
      isEmailVerified: false,
    })
    await seedUser(dataSource, {
      email: SEARCH_EMAIL_B,
      password: PASSWORD,
      firstName: 'Zephyrine-B',
      role: UserRole.USER,
      isEmailVerified: true,
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [
      ADMIN_EMAIL,
      USER_EMAIL,
      SEARCH_EMAIL_A,
      SEARCH_EMAIL_B,
    ])
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

  it('meta.totalItems reflects the real count, not the page limit', async () => {
    // Request a single row (limit=1). A correct count() ignores the take limit
    // and reports the real total, which is always >= the 2 users seeded above.
    // If count() wrongly applied the take limit, totalItems would be 1.
    //
    // We assert a lower bound (>= 2), never `totalItems >= data.length`: the user
    // table is shared by every e2e suite, so a parallel insert between count() and
    // find() can make find() return more rows than count() saw. totalItems only
    // grows, so the lower bound is race-free.
    const res = await request(app.getHttpServer())
      .get('/users?limit=1&page=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<User>>).data
    expect(body.data.length).toBe(1) // the page limit is respected
    expect(body.meta.totalItems).toBeGreaterThanOrEqual(2) // count is not capped at the limit
  })

  // ── GET /users — search, filters, and sort ────────────────────────────────

  it('q searches across firstName, lastName, and email, case-insensitively', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ q: 'zephyrine' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<User>>).data
    const emails = body.data.map((u) => u.email)
    expect(emails).toEqual(
      expect.arrayContaining([SEARCH_EMAIL_A, SEARCH_EMAIL_B]),
    )
  })

  it('role filters to an exact match, scoped by q', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ q: 'Zephyrine', role: UserRole.EDITOR })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<User>>).data
    const emails = body.data.map((u) => u.email)
    expect(emails).toContain(SEARCH_EMAIL_A)
    expect(emails).not.toContain(SEARCH_EMAIL_B)
  })

  it('isEmailVerified filters by verification status, scoped by q', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ q: 'Zephyrine', isEmailVerified: false })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<User>>).data
    const emails = body.data.map((u) => u.email)
    expect(emails).toContain(SEARCH_EMAIL_A)
    expect(emails).not.toContain(SEARCH_EMAIL_B)
  })

  it('sortBy/order sorts the scoped result set', async () => {
    const asc = await request(app.getHttpServer())
      .get('/users')
      .query({ q: 'Zephyrine', sortBy: 'email', order: 'asc' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const desc = await request(app.getHttpServer())
      .get('/users')
      .query({ q: 'Zephyrine', sortBy: 'email', order: 'desc' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const ascEmails = (asc.body as ApiResponse<Paginated<User>>).data.data
      .map((u) => u.email)
      .filter((e) => e === SEARCH_EMAIL_A || e === SEARCH_EMAIL_B)
    const descEmails = (desc.body as ApiResponse<Paginated<User>>).data.data
      .map((u) => u.email)
      .filter((e) => e === SEARCH_EMAIL_A || e === SEARCH_EMAIL_B)

    expect(ascEmails).toEqual([SEARCH_EMAIL_A, SEARCH_EMAIL_B])
    expect(descEmails).toEqual([SEARCH_EMAIL_B, SEARCH_EMAIL_A])
  })

  it('rejects an invalid sortBy value with 400', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .query({ sortBy: 'password' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400)
  })
})
