import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { ContactSubmission } from '../../src/contact/entities/contact-submission.entity'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { AuditLog } from '../../src/audit-log/entities/audit-log.entity'
import { AuditAction } from '../../src/audit-log/enums/audit-action.enum'
import { Paginated } from '../../src/common/pagination/interfaces/paginated.interface'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('Contact form (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let submissionRepo: Repository<ContactSubmission>
  let auditLogRepo: Repository<AuditLog>
  // captured so tests can assert the mail side-effect fires
  let sendContactNotificationMock: jest.Mock

  let adminToken: string
  let userToken: string

  const ADMIN_EMAIL = 'contact-admin@e2e.test'
  const USER_EMAIL = 'contact-user@e2e.test'
  const PASSWORD = 'Password1!'

  const VALID_PAYLOAD = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Hiring inquiry',
    message: 'Hello, I wanted to reach out about a potential role.',
  }

  beforeAll(async () => {
    sendContactNotificationMock = jest.fn().mockResolvedValue(undefined)
    ;({ app, dataSource } = await createApp({
      mailMock: { sendContactNotification: sendContactNotificationMock },
    }))
    submissionRepo = dataSource.getRepository(ContactSubmission)
    auditLogRepo = dataSource.getRepository(AuditLog)
    // Pre-cleanup so re-runs don't accumulate rows from previous failures.
    await submissionRepo.clear()
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ContactAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'ContactUser',
      role: UserRole.USER,
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    await submissionRepo.clear()
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── POST /contact ─────────────────────────────────────────────────────────

  it('valid payload (unauthenticated) → 201, returns submission fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/contact')
      .send(VALID_PAYLOAD)
      .expect(201)

    const submission = (res.body as ApiResponse<ContactSubmission>).data
    expect(submission.id).toBeGreaterThan(0)
    expect(submission.name).toBe(VALID_PAYLOAD.name)
    expect(submission.email).toBe(VALID_PAYLOAD.email)
    expect(submission.subject).toBe(VALID_PAYLOAD.subject)
    expect(submission.createdAt).toBeDefined()
  })

  it('valid payload → row persisted in DB', async () => {
    const res = await request(app.getHttpServer())
      .post('/contact')
      .send(VALID_PAYLOAD)
      .expect(201)

    const id: number = (res.body as ApiResponse<ContactSubmission>).data.id
    const row: ContactSubmission | null = await submissionRepo.findOneBy({ id })
    expect(row).not.toBeNull()
    expect(row!.name).toBe(VALID_PAYLOAD.name)
    expect(row!.email).toBe(VALID_PAYLOAD.email)
  })

  it('successful submission → mail notification sent to owner', async () => {
    sendContactNotificationMock.mockClear()

    await request(app.getHttpServer())
      .post('/contact')
      .send(VALID_PAYLOAD)
      .expect(201)

    expect(sendContactNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendContactNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: VALID_PAYLOAD.name,
        email: VALID_PAYLOAD.email,
        subject: VALID_PAYLOAD.subject,
        message: VALID_PAYLOAD.message,
      }),
    )
  })

  it('missing required field (message) → 400', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({ name: 'Jane', email: 'jane@example.com', subject: 'Hi' })
      .expect(400)
  })

  it('invalid email format → 400', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({ ...VALID_PAYLOAD, email: 'not-an-email' })
      .expect(400)
  })

  it('message exceeding 2000 chars → 400', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({ ...VALID_PAYLOAD, message: 'a'.repeat(2001) })
      .expect(400)
  })

  it('whitespace-only name → 400 (trim runs before @IsNotEmpty)', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({ ...VALID_PAYLOAD, name: '   ' })
      .expect(400)
  })

  // ── GET /contact (admin only, paginated) ─────────────────────────────────

  describe('GET /contact', () => {
    let handledId: number
    let unhandledId: number

    beforeAll(async () => {
      const handled = await submissionRepo.save(
        submissionRepo.create({
          name: 'Handled Sender',
          email: 'handled@e2e.test',
          subject: 'Handled subject',
          message: 'This one has been reviewed.',
          handled: true,
        }),
      )
      handledId = handled.id

      const unhandled = await submissionRepo.save(
        submissionRepo.create({
          name: 'Unhandled Sender',
          email: 'unhandled@e2e.test',
          subject: 'Unhandled subject',
          message: 'This one has not been reviewed.',
          handled: false,
        }),
      )
      unhandledId = unhandled.id
    })

    it('no token → 401', async () => {
      await request(app.getHttpServer()).get('/contact').expect(401)
    })

    it('USER role → 403', async () => {
      await request(app.getHttpServer())
        .get('/contact')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })

    it('ADMIN → 200 paginated shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/contact')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = (res.body as ApiResponse<Paginated<ContactSubmission>>).data
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.meta.totalItems).toBeGreaterThanOrEqual(2)
    })

    it('?handled=true → only handled submissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/contact')
        .query({ handled: 'true', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = (res.body as ApiResponse<Paginated<ContactSubmission>>).data
      const ids = body.data.map((s) => s.id)
      expect(ids).toContain(handledId)
      expect(ids).not.toContain(unhandledId)
      expect(body.data.every((s) => s.handled)).toBe(true)
    })

    it('?handled=false → only unhandled submissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/contact')
        .query({ handled: 'false', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = (res.body as ApiResponse<Paginated<ContactSubmission>>).data
      const ids = body.data.map((s) => s.id)
      expect(ids).toContain(unhandledId)
      expect(ids).not.toContain(handledId)
      expect(body.data.every((s) => !s.handled)).toBe(true)
    })

    it('?startDate/?endDate filters by createdAt range', async () => {
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)

      const res = await request(app.getHttpServer())
        .get('/contact')
        .query({ startDate: farFuture })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = (res.body as ApiResponse<Paginated<ContactSubmission>>).data
      expect(body.data).toEqual([])
    })
  })

  // ── GET /contact/:id (admin only) ────────────────────────────────────────

  describe('GET /contact/:id', () => {
    let submissionId: number

    beforeAll(async () => {
      const saved = await submissionRepo.save(
        submissionRepo.create({
          name: 'Single Read Sender',
          email: 'single-read@e2e.test',
          subject: 'Single read subject',
          message: 'Used for the GET /contact/:id tests.',
        }),
      )
      submissionId = saved.id
    })

    it('no token → 401', async () => {
      await request(app.getHttpServer())
        .get(`/contact/${submissionId}`)
        .expect(401)
    })

    it('USER role → 403', async () => {
      await request(app.getHttpServer())
        .get(`/contact/${submissionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })

    it('ADMIN → 200 with the submission', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contact/${submissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const submission = (res.body as ApiResponse<ContactSubmission>).data
      expect(submission.id).toBe(submissionId)
    })

    it('ADMIN, non-existent id → 404', async () => {
      await request(app.getHttpServer())
        .get('/contact/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })
  })

  // ── PATCH /contact/:id (admin only) ──────────────────────────────────────

  describe('PATCH /contact/:id', () => {
    let submissionId: number

    beforeAll(async () => {
      const saved = await submissionRepo.save(
        submissionRepo.create({
          name: 'Patch Target Sender',
          email: 'patch-target@e2e.test',
          subject: 'Patch target subject',
          message: 'Used for the PATCH /contact/:id tests.',
          handled: false,
        }),
      )
      submissionId = saved.id
    })

    it('no token → 401', async () => {
      await request(app.getHttpServer())
        .patch(`/contact/${submissionId}`)
        .send({ handled: true })
        .expect(401)
    })

    it('USER role → 403', async () => {
      await request(app.getHttpServer())
        .patch(`/contact/${submissionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ handled: true })
        .expect(403)
    })

    it('missing handled in body → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/contact/${submissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400)
    })

    it('ADMIN, non-existent id → 404', async () => {
      await request(app.getHttpServer())
        .patch('/contact/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ handled: true })
        .expect(404)
    })

    it('ADMIN → 200, row updated, and an AuditLog row is written', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/contact/${submissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ handled: true })
        .expect(200)

      const submission = (res.body as ApiResponse<ContactSubmission>).data
      expect(submission.handled).toBe(true)

      const row: ContactSubmission | null = await submissionRepo.findOneBy({
        id: submissionId,
      })
      expect(row!.handled).toBe(true)

      const auditRow: AuditLog | null = await auditLogRepo.findOneBy({
        entity: 'ContactSubmission',
        entityId: submissionId,
        action: AuditAction.UPDATE,
      })
      expect(auditRow).not.toBeNull()
    })
  })
})
