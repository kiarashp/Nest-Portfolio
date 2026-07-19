import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { SegmentDataType } from '../../src/configurator/enums/segment-data-type.enum'
import { SegmentDefinition } from '../../src/configurator/entities/segment-definition.entity'
import { ConfigurableProduct } from '../../src/configurator/entities/configurable-product.entity'
import { ProductSegmentAssignment } from '../../src/configurator/entities/product-segment-assignment.entity'
import { SavedConfiguration } from '../../src/configurator/entities/saved-configuration.entity'
import { QuoteMessage } from '../../src/configurator/entities/quote-message.entity'
import { AuditLog } from '../../src/audit-log/entities/audit-log.entity'
import { AuditAction } from '../../src/audit-log/enums/audit-action.enum'
import { Paginated } from '../../src/common/pagination/interfaces/paginated.interface'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Exercises the quote-request message threads: the owner and admin
// :id/messages routes, the quoteStatus transitions message posts perform,
// the per-side unread counts on both list endpoints, and the mail events.
// Fixture: one two-segment product built through the real admin HTTP APIs;
// snapshots are created fresh per test so each starts from a known status.
describe('Configurator quote messages (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let ownerToken: string
  let otherToken: string

  let segmentDefinitionRepo: Repository<SegmentDefinition>
  let configurableProductRepo: Repository<ConfigurableProduct>
  let auditLogRepo: Repository<AuditLog>

  const sendQuoteRequestMailMock = jest.fn().mockResolvedValue(undefined)
  const sendQuoteMessageNotificationMock = jest
    .fn()
    .mockResolvedValue(undefined)
  const sendQuoteReplyMailMock = jest.fn().mockResolvedValue(undefined)

  const ADMIN_EMAIL = 'quote-messages-admin@e2e.test'
  const OWNER_EMAIL = 'quote-messages-owner@e2e.test'
  const OTHER_EMAIL = 'quote-messages-other@e2e.test'
  const EMAILS = [ADMIN_EMAIL, OWNER_EMAIL, OTHER_EMAIL]
  const PASSWORD = 'Password1!'

  const MAIN_SLUG = 'e2e-quote-messages-main'
  const MAIN_NAME = 'E2E Quote Messages Product'
  const DEFINITION_NAMES = ['E2E QMsg Def - Color', 'E2E QMsg Def - Length']

  let aColor: number
  let aLength: number

  const EXPECTED_CODE = 'QMS-rd-250'

  const validSelections = (): Record<string, string> => ({
    [aColor]: 'rd',
    [aLength]: '250',
  })

  // Saves a fresh snapshot for the given token and returns the created row.
  const saveValid = async (token: string): Promise<SavedConfiguration> => {
    const res = await request(app.getHttpServer())
      .post(`/configurators/${MAIN_SLUG}/save`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections: validSelections() })
      .expect(201)
    return (res.body as ApiResponse<SavedConfiguration>).data
  }

  // Saves a snapshot and immediately requests a quote for it (no message).
  const saveAndRequestQuote = async (
    token: string,
  ): Promise<SavedConfiguration> => {
    const created = await saveValid(token)
    const res = await request(app.getHttpServer())
      .post(`/saved-configurations/${created.id}/request-quote`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    return (res.body as ApiResponse<SavedConfiguration>).data
  }

  const postOwnerMessage = (token: string, id: number, body: string) =>
    request(app.getHttpServer())
      .post(`/saved-configurations/${id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body })

  const postAdminMessage = (id: number, body: string) =>
    request(app.getHttpServer())
      .post(`/saved-configurations/admin/${id}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body })

  const getAdminSnapshot = async (id: number): Promise<SavedConfiguration> => {
    const res = await request(app.getHttpServer())
      .get(`/saved-configurations/admin/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    return (res.body as ApiResponse<SavedConfiguration>).data
  }

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp({
      mailMock: {
        sendQuoteRequestMail: sendQuoteRequestMailMock,
        sendQuoteMessageNotification: sendQuoteMessageNotificationMock,
        sendQuoteReplyMail: sendQuoteReplyMailMock,
      },
    }))

    segmentDefinitionRepo = dataSource.getRepository(SegmentDefinition)
    configurableProductRepo = dataSource.getRepository(ConfigurableProduct)
    auditLogRepo = dataSource.getRepository(AuditLog)

    // Pre-cleanup: users first (saved configurations and their messages
    // cascade away via the userId FK), then the product (assignments
    // cascade), then definitions.
    await cleanupUsers(dataSource, EMAILS)
    await configurableProductRepo.delete({ slug: MAIN_SLUG })
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'QuoteMessagesAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: OWNER_EMAIL,
      password: PASSWORD,
      firstName: 'QuoteMessagesOwner',
    })
    await seedUser(dataSource, {
      email: OTHER_EMAIL,
      password: PASSWORD,
      firstName: 'QuoteMessagesOther',
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    ownerToken = await getAuthToken(app, OWNER_EMAIL, PASSWORD)
    otherToken = await getAuthToken(app, OTHER_EMAIL, PASSWORD)

    // ── Definitions ─────────────────────────────────────────────────────
    const color = await request(app.getHttpServer())
      .post('/configurator-definitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E QMsg Def - Color',
        label: 'Color',
        dataType: SegmentDataType.SELECT,
        meaningTemplate: 'Color: {label}',
      })
      .expect(201)
    const dColor = (color.body as ApiResponse<SegmentDefinition>).data.id
    // SELECT definitions need at least 2 options before they can be assigned.
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${dColor}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'rd', label: 'Red' })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${dColor}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'bl', label: 'Blue' })
      .expect(201)

    const length = await request(app.getHttpServer())
      .post('/configurator-definitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E QMsg Def - Length',
        label: 'Length (mm)',
        dataType: SegmentDataType.NUMBER,
        constraints: { digits: 3, min: 10, max: 500 },
        meaningTemplate: 'Length: {value} mm',
      })
      .expect(201)
    const dLength = (length.body as ApiResponse<SegmentDefinition>).data.id

    // ── Product + assignments ───────────────────────────────────────────
    const product = await request(app.getHttpServer())
      .post('/configurator-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: MAIN_NAME,
        slug: MAIN_SLUG,
        codePrefix: 'QMS',
        isPublished: true,
      })
      .expect(201)
    const productId = (product.body as ApiResponse<ConfigurableProduct>).data.id

    const rColor = await request(app.getHttpServer())
      .post(`/configurator-products/${productId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ definitionId: dColor })
      .expect(201)
    aColor = (rColor.body as ApiResponse<ProductSegmentAssignment>).data.id
    const rLength = await request(app.getHttpServer())
      .post(`/configurator-products/${productId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ definitionId: dLength })
      .expect(201)
    aLength = (rLength.body as ApiResponse<ProductSegmentAssignment>).data.id
  })

  afterAll(async () => {
    // Users first so their saved configurations (and cascading messages) go
    // before the product/definitions.
    await cleanupUsers(dataSource, EMAILS)
    await configurableProductRepo.delete({ slug: MAIN_SLUG })
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await app.close()
  })

  beforeEach(() => {
    sendQuoteRequestMailMock.mockClear()
    sendQuoteMessageNotificationMock.mockClear()
    sendQuoteReplyMailMock.mockClear()
  })

  // ── POST /saved-configurations/:id/messages ─────────────────────────────

  describe('POST /saved-configurations/:id/messages', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .post('/saved-configurations/1/messages')
        .send({ body: 'hello' })
        .expect(401)
    })

    it("404s for another user's snapshot — indistinguishable from missing", async () => {
      const created = await saveAndRequestQuote(ownerToken)

      await postOwnerMessage(otherToken, created.id, 'hello').expect(404)
    })

    it('400s before a quote is requested', async () => {
      const created = await saveValid(ownerToken)

      await postOwnerMessage(ownerToken, created.id, 'hello').expect(400)
      expect(sendQuoteMessageNotificationMock).not.toHaveBeenCalled()
    })

    it('400s on an empty or over-long body', async () => {
      const created = await saveAndRequestQuote(ownerToken)

      await postOwnerMessage(ownerToken, created.id, '').expect(400)
      await postOwnerMessage(ownerToken, created.id, 'x'.repeat(5001)).expect(
        400,
      )
    })

    it('201s with senderRole user, emails the owner notification, audits', async () => {
      const created = await saveAndRequestQuote(ownerToken)

      const res = await postOwnerMessage(
        ownerToken,
        created.id,
        'Can you quote 50 units?',
      ).expect(201)
      const message = (res.body as ApiResponse<QuoteMessage>).data

      expect(message.savedConfigurationId).toBe(created.id)
      expect(message.senderRole).toBe('user')
      expect(message.body).toBe('Can you quote 50 units?')

      expect(sendQuoteMessageNotificationMock).toHaveBeenCalledTimes(1)
      expect(sendQuoteMessageNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          savedConfigurationId: created.id,
          userEmail: OWNER_EMAIL,
          userFirstName: 'QuoteMessagesOwner',
          productName: MAIN_NAME,
          code: EXPECTED_CODE,
          messageBody: 'Can you quote 50 units?',
        }),
      )

      const auditRow: AuditLog | null = await auditLogRepo.findOneBy({
        entity: 'QuoteMessage',
        entityId: message.id,
        action: AuditAction.CREATE,
      })
      expect(auditRow).not.toBeNull()
    })

    it('reopens a CLOSED thread back to PENDING', async () => {
      const created = await saveAndRequestQuote(ownerToken)
      await request(app.getHttpServer())
        .patch(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quoteStatus: 'CLOSED' })
        .expect(200)

      await postOwnerMessage(ownerToken, created.id, 'reopening this').expect(
        201,
      )

      const snapshot = await getAdminSnapshot(created.id)
      expect(snapshot.quoteStatus).toBe('PENDING')
    })
  })

  // ── GET /saved-configurations/:id/messages ──────────────────────────────

  describe('GET /saved-configurations/:id/messages', () => {
    it("404s for another user's snapshot", async () => {
      const created = await saveAndRequestQuote(ownerToken)

      await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}/messages`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
    })

    it('returns an empty page (not 400) for a snapshot without a quote request', async () => {
      const created = await saveValid(ownerToken)

      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<QuoteMessage>>).data

      expect(page.data).toEqual([])
      expect(page.meta.totalItems).toBe(0)
    })

    it('returns the thread newest first with the shared pagination shape', async () => {
      const created = await saveAndRequestQuote(ownerToken)
      await postOwnerMessage(ownerToken, created.id, 'first').expect(201)
      await postOwnerMessage(ownerToken, created.id, 'second').expect(201)
      await postOwnerMessage(ownerToken, created.id, 'third').expect(201)

      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}/messages`)
        .query({ limit: 2, page: 1 })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<QuoteMessage>>).data

      // The thread is private to this snapshot, so exact totals are safe.
      expect(page.meta.totalItems).toBe(3)
      expect(page.meta.itemsPerPage).toBe(2)
      expect(page.data.map((m) => m.body)).toEqual(['third', 'second'])
    })
  })

  // ── POST /saved-configurations/admin/:id/messages ───────────────────────

  describe('POST /saved-configurations/admin/:id/messages', () => {
    it('401s without a token and 403s for non-admin roles', async () => {
      await request(app.getHttpServer())
        .post('/saved-configurations/admin/1/messages')
        .send({ body: 'reply' })
        .expect(401)

      await request(app.getHttpServer())
        .post('/saved-configurations/admin/1/messages')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ body: 'reply' })
        .expect(403)
    })

    it('bumps PENDING to ANSWERED and emails the thread owner', async () => {
      const created = await saveAndRequestQuote(ownerToken)
      expect(created.quoteStatus).toBe('PENDING')

      const res = await postAdminMessage(
        created.id,
        'Sure — quote attached.',
      ).expect(201)
      const message = (res.body as ApiResponse<QuoteMessage>).data
      expect(message.senderRole).toBe('admin')

      const snapshot = await getAdminSnapshot(created.id)
      expect(snapshot.quoteStatus).toBe('ANSWERED')

      expect(sendQuoteReplyMailMock).toHaveBeenCalledTimes(1)
      expect(sendQuoteReplyMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: OWNER_EMAIL,
          userFirstName: 'QuoteMessagesOwner',
          productName: MAIN_NAME,
          code: EXPECTED_CODE,
          messageBody: 'Sure — quote attached.',
        }),
      )
    })

    it('leaves a CLOSED thread closed', async () => {
      const created = await saveAndRequestQuote(ownerToken)
      await request(app.getHttpServer())
        .patch(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quoteStatus: 'CLOSED' })
        .expect(200)

      await postAdminMessage(created.id, 'closing note').expect(201)

      const snapshot = await getAdminSnapshot(created.id)
      expect(snapshot.quoteStatus).toBe('CLOSED')
    })
  })

  // ── GET /saved-configurations/admin/:id/messages ────────────────────────

  describe('GET /saved-configurations/admin/:id/messages', () => {
    it('403s for a non-admin role', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/admin/1/messages')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403)
    })

    it("returns any user's thread with both sides' messages", async () => {
      const created = await saveAndRequestQuote(ownerToken)
      await postOwnerMessage(ownerToken, created.id, 'question').expect(201)
      await postAdminMessage(created.id, 'answer').expect(201)

      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/admin/${created.id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<QuoteMessage>>).data

      expect(page.meta.totalItems).toBe(2)
      expect(page.data.map((m) => [m.senderRole, m.body])).toEqual([
        ['admin', 'answer'],
        ['user', 'question'],
      ])
    })
  })

  // ── Unread counts ───────────────────────────────────────────────────────

  describe('unread counts', () => {
    it('owner list: admin reply counts as unread until the owner reads, own messages never count', async () => {
      const created = await saveAndRequestQuote(ownerToken)

      // The owner's own message must not count toward their unread.
      await postOwnerMessage(ownerToken, created.id, 'my own message').expect(
        201,
      )
      let res = await request(app.getHttpServer())
        .get('/saved-configurations')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      let row = (
        res.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.find((r) => r.id === created.id)
      expect(row?.unreadCount).toBe(0)

      // An admin reply becomes 1 unread for the owner.
      await postAdminMessage(created.id, 'admin reply').expect(201)
      res = await request(app.getHttpServer())
        .get('/saved-configurations')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      row = (
        res.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.find((r) => r.id === created.id)
      expect(row?.unreadCount).toBe(1)

      // Reading the thread stamps userLastReadAt and clears the count.
      await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      res = await request(app.getHttpServer())
        .get('/saved-configurations')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      row = (
        res.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.find((r) => r.id === created.id)
      expect(row?.unreadCount).toBe(0)
    })

    it('admin inbox: user message counts as unread until an admin reads', async () => {
      const created = await saveAndRequestQuote(ownerToken)
      await postOwnerMessage(ownerToken, created.id, 'ping').expect(201)

      let res = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      let row = (
        res.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.find((r) => r.id === created.id)
      expect(row?.unreadCount).toBe(1)

      await request(app.getHttpServer())
        .get(`/saved-configurations/admin/${created.id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      res = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      row = (
        res.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.find((r) => r.id === created.id)
      expect(row?.unreadCount).toBe(0)
    })
  })

  // ── Request-quote with a first message ──────────────────────────────────

  describe('POST /saved-configurations/:id/request-quote with message', () => {
    it('stores the first thread message and rides it in the quote-request mail only', async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ message: 'Need delivery by Q4.' })
        .expect(200)

      // The message exists as the first thread message.
      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<QuoteMessage>>).data
      expect(page.meta.totalItems).toBe(1)
      expect(page.data[0].senderRole).toBe('user')
      expect(page.data[0].body).toBe('Need delivery by Q4.')

      // It rides inside the quote-request email — no separate message mail.
      expect(sendQuoteRequestMailMock).toHaveBeenCalledTimes(1)
      expect(sendQuoteRequestMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Need delivery by Q4.' }),
      )
      expect(sendQuoteMessageNotificationMock).not.toHaveBeenCalled()
    })
  })
})
