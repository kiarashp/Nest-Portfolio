import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../src/auth/enums/user-role.enum'
import { ApiResponse, getAuthToken } from './helpers/auth.helper'
import { createApp } from './helpers/create-app.helper'
import { cleanupUsers, seedUser } from './helpers/seed.helper'

interface AdminStats {
  posts: { draft: number; review: number; scheduled: number; published: number }
  products: { published: number; draft: number; total: number }
  productTypes: number
  users: number
  contactSubmissions: number
}

describe('GET /admin/stats (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string

  const ADMIN_EMAIL = 'admin-stats-admin@e2e.test'
  const USER_EMAIL = 'admin-stats-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'StatsAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'StatsUser',
      role: UserRole.USER,
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  it('GET /admin/stats (no token) → 401', async () => {
    await request(app.getHttpServer()).get('/admin/stats').expect(401)
  })

  it('GET /admin/stats (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('GET /admin/stats (ADMIN) → 200 with the full aggregate shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const stats = (res.body as ApiResponse<AdminStats>).data

    expect(typeof stats.posts.draft).toBe('number')
    expect(typeof stats.posts.review).toBe('number')
    expect(typeof stats.posts.scheduled).toBe('number')
    expect(typeof stats.posts.published).toBe('number')
    expect(typeof stats.products.published).toBe('number')
    expect(typeof stats.products.draft).toBe('number')
    expect(typeof stats.productTypes).toBe('number')
    expect(typeof stats.users).toBe('number')
    expect(typeof stats.contactSubmissions).toBe('number')

    // Internal consistency, not a seeded-baseline comparison: this endpoint
    // aggregates whole tables with no per-suite scoping filter available, so
    // exact-count assertions would be flaky under the shared parallel e2e DB.
    expect(stats.products.total).toBe(
      stats.products.published + stats.products.draft,
    )
    // At least the two users seeded by this suite must be counted.
    expect(stats.users).toBeGreaterThanOrEqual(2)
  })
})
