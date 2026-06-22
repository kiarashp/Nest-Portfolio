import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { ContactSubmission } from '../../src/contact/entities/contact-submission.entity'
import { ApiResponse } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'

describe('Contact form (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let submissionRepo: Repository<ContactSubmission>
  // captured so tests can assert the mail side-effect fires
  let sendContactNotificationMock: jest.Mock

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
    // Pre-cleanup so re-runs don't accumulate rows from previous failures.
    await submissionRepo.clear()
  })

  afterAll(async () => {
    await submissionRepo.clear()
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
})
