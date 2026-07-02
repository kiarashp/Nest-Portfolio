import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../src/auth/enums/user-role.enum'
import { ApiResponse, getAuthToken } from './helpers/auth.helper'
import { createApp } from './helpers/create-app.helper'
import { cleanupUsers, seedUser } from './helpers/seed.helper'
import { AuditLog } from '../src/audit-log/entities/audit-log.entity'
import { AuditAction } from '../src/audit-log/enums/audit-action.enum'
import { Paginated } from '../src/common/pagination/interfaces/paginated.interface'

describe('GET /audit-logs (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string
  let adminUserId: number
  let auditLogRepo: Repository<AuditLog>

  const ADMIN_EMAIL = 'audit-admin@e2e.test'
  const USER_EMAIL = 'audit-user@e2e.test'
  const PASSWORD = 'Password1!'
  const MISSING_USER_ID = 999999

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Pre-cleanup: remove rows from a previously failed run.
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    const adminUser = await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'AuditAdmin',
      role: UserRole.ADMIN,
    })
    adminUserId = adminUser.id
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'AuditUser',
      role: UserRole.USER,
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    auditLogRepo = dataSource.getRepository(AuditLog)

    // Seed a few rows directly so we have data to assert on.
    await auditLogRepo.save([
      {
        userId: adminUserId,
        action: AuditAction.CREATE,
        entity: 'Post',
        entityId: 100,
      },
      {
        userId: adminUserId,
        action: AuditAction.UPDATE,
        entity: 'Post',
        entityId: 100,
      },
      { userId: 2, action: AuditAction.DELETE, entity: 'Tag', entityId: 5 },
      // No actor (mirrors self-registration).
      {
        userId: null,
        action: AuditAction.CREATE,
        entity: 'User',
        entityId: 200,
      },
      // Actor whose User row no longer exists (mirrors a hard-deleted user).
      {
        userId: MISSING_USER_ID,
        action: AuditAction.DELETE,
        entity: 'User',
        entityId: 201,
      },
    ])
  })

  afterAll(async () => {
    // Remove only the rows we inserted; don't wipe rows written by other suites.
    await auditLogRepo.delete({ entity: 'Post', entityId: 100 })
    await auditLogRepo.delete({ entity: 'Tag', entityId: 5 })
    await auditLogRepo.delete({ entity: 'User', entityId: 200 })
    await auditLogRepo.delete({ entity: 'User', entityId: 201 })
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── GET /audit-logs ───────────────────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    await request(app.getHttpServer()).get('/audit-logs').expect(401)
  })

  it('returns 403 for a USER role token', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('returns 200 with paginated shape for ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    expect(body.data).toHaveProperty('data')
    expect(body.data).toHaveProperty('meta')
    expect(body.data).toHaveProperty('links')
    expect(Array.isArray(body.data.data)).toBe(true)
    expect(body.data.meta.totalItems).toBeGreaterThanOrEqual(5)
  })

  it('filters by entity when ?entity=Post is provided', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entity=Post')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const rows = body.data.data
    expect(rows.length).toBeGreaterThanOrEqual(2)
    // Every returned row must be a Post entry
    rows.forEach((row) => expect(row.entity).toBe('Post'))
  })

  it('filters by action when ?action=DELETE is provided', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?action=DELETE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const rows = body.data.data
    expect(rows.length).toBeGreaterThanOrEqual(1)
    rows.forEach((row) => expect(row.action).toBe('DELETE'))
  })

  it('respects pagination params', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?limit=1&page=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    expect(body.data.data.length).toBeLessThanOrEqual(1)
    expect(body.data.meta.itemsPerPage).toBe(1)
  })

  // ── Sorting ────────────────────────────────────────────────────────────────

  it('sorts by action ascending when ?sortBy=action&order=asc is provided', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?sortBy=action&order=asc&limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const actions = body.data.data.map((row) => row.action)
    const sorted = [...actions].sort((a, b) => a.localeCompare(b))
    expect(actions).toEqual(sorted)
  })

  it('defaults to createdAt desc when no sortBy/order is provided', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const timestamps = body.data.data.map((row) =>
      new Date(row.createdAt).getTime(),
    )
    const sortedDesc = [...timestamps].sort((a, b) => b - a)
    expect(timestamps).toEqual(sortedDesc)
  })

  it('returns 400 for an invalid sortBy', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs?sortBy=bogus')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400)
  })

  it('returns 400 for an invalid order', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs?order=bogus')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400)
  })

  // ── User snapshot ──────────────────────────────────────────────────────────

  it('returns user: null for a row with no actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entity=User&action=CREATE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const row = body.data.data.find((r) => r.entityId === 200)
    expect(row?.user).toBeNull()
  })

  it('returns a live snapshot with deleted: false for an existing actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entity=Post')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const row = body.data.data.find((r) => r.entityId === 100)
    expect(row?.user).toMatchObject({
      id: adminUserId,
      firstName: 'AuditAdmin',
      email: ADMIN_EMAIL,
      deleted: false,
    })
  })

  it('returns deleted: true with null fields for a hard-deleted actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entity=User&action=DELETE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = res.body as ApiResponse<Paginated<AuditLog>>
    const row = body.data.data.find((r) => r.entityId === 201)
    expect(row?.user).toEqual({
      id: MISSING_USER_ID,
      firstName: null,
      lastName: null,
      email: null,
      deleted: true,
    })
  })
})
