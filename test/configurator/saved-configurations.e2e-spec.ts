import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { SegmentDataType } from '../../src/configurator/enums/segment-data-type.enum'
import { SegmentDefinition } from '../../src/configurator/entities/segment-definition.entity'
import { SegmentOption } from '../../src/configurator/entities/segment-option.entity'
import { ConfigurableProduct } from '../../src/configurator/entities/configurable-product.entity'
import { ProductSegmentAssignment } from '../../src/configurator/entities/product-segment-assignment.entity'
import { SavedConfiguration } from '../../src/configurator/entities/saved-configuration.entity'
import { AuditLog } from '../../src/audit-log/entities/audit-log.entity'
import { AuditAction } from '../../src/audit-log/enums/audit-action.enum'
import { Paginated } from '../../src/common/pagination/interfaces/paginated.interface'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Exercises Phase 2's saved configurations (CONFIGURATOR.md §5.3/§7 Step 6):
// POST /configurators/:slug/save plus the owner-scoped /saved-configurations
// routes. The fixture is a compact two-segment product built through the real
// admin HTTP APIs; snapshots are created by a plain USER-role owner and a
// second user proves the owner-scoped 404s.
describe('Configurator saved configurations (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let ownerToken: string
  let otherToken: string
  let ownerId: number

  let segmentDefinitionRepo: Repository<SegmentDefinition>
  let configurableProductRepo: Repository<ConfigurableProduct>
  let auditLogRepo: Repository<AuditLog>

  const sendQuoteRequestMailMock = jest.fn().mockResolvedValue(undefined)

  const ADMIN_EMAIL = 'configurator-saved-admin@e2e.test'
  const OWNER_EMAIL = 'configurator-saved-owner@e2e.test'
  const OTHER_EMAIL = 'configurator-saved-other@e2e.test'
  const EMAILS = [ADMIN_EMAIL, OWNER_EMAIL, OTHER_EMAIL]
  const PASSWORD = 'Password1!'

  const MAIN_SLUG = 'e2e-configurator-saved-main'
  const UNPUBLISHED_SLUG = 'e2e-configurator-saved-unpublished'
  const PRODUCT_SLUGS = [MAIN_SLUG, UNPUBLISHED_SLUG]
  const MAIN_NAME = 'E2E Saved Main Product'

  const DEFINITION_NAMES = ['E2E Saved Def - Color', 'E2E Saved Def - Length']

  // Assignment ids of the two segments on the main product, captured while
  // seeding, plus the "Red" option id for the immutability test.
  let aColor: number
  let aLength: number
  let optRedId: number

  const createDefinition = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/configurator-definitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  const createOption = (definitionId: number, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/configurator-definitions/${definitionId}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  const createProduct = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/configurator-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  const createAssignment = (productId: number, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/configurator-products/${productId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  const save = (
    token: string,
    selections: Record<string, unknown>,
    slug: string = MAIN_SLUG,
  ) =>
    request(app.getHttpServer())
      .post(`/configurators/${slug}/save`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections })

  // Valid selections for the main product and their expected snapshot.
  const validSelections = (): Record<string, string> => ({
    [aColor]: 'rd',
    [aLength]: '250',
  })
  const EXPECTED_CODE = 'SAV-rd-250'
  const EXPECTED_SUMMARY = ['Color: Red', 'Length: 250 mm']

  // Saves a valid snapshot for the given token and returns the created row.
  const saveValid = async (token: string): Promise<SavedConfiguration> => {
    const res = await save(token, validSelections()).expect(201)
    return (res.body as ApiResponse<SavedConfiguration>).data
  }

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp({
      mailMock: { sendQuoteRequestMail: sendQuoteRequestMailMock },
    }))

    segmentDefinitionRepo = dataSource.getRepository(SegmentDefinition)
    configurableProductRepo = dataSource.getRepository(ConfigurableProduct)
    auditLogRepo = dataSource.getRepository(AuditLog)

    // Pre-cleanup: users first (their saved configurations cascade away via
    // the userId FK), then products (assignments cascade), then definitions —
    // so a previous failed run never leaves FK/unique conflicts.
    await cleanupUsers(dataSource, EMAILS)
    for (const slug of PRODUCT_SLUGS) {
      await configurableProductRepo.delete({ slug })
    }
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorSavedAdmin',
      role: UserRole.ADMIN,
    })
    const owner = await seedUser(dataSource, {
      email: OWNER_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorSavedOwner',
    })
    ownerId = owner.id
    await seedUser(dataSource, {
      email: OTHER_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorSavedOther',
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    ownerToken = await getAuthToken(app, OWNER_EMAIL, PASSWORD)
    otherToken = await getAuthToken(app, OTHER_EMAIL, PASSWORD)

    // ── Definitions ─────────────────────────────────────────────────────
    const color = await createDefinition({
      name: 'E2E Saved Def - Color',
      label: 'Color',
      dataType: SegmentDataType.SELECT,
      meaningTemplate: 'Color: {label}',
    }).expect(201)
    const dColor = (color.body as ApiResponse<SegmentDefinition>).data.id
    const optRed = await createOption(dColor, {
      value: 'rd',
      label: 'Red',
    }).expect(201)
    optRedId = (optRed.body as ApiResponse<SegmentOption>).data.id
    await createOption(dColor, { value: 'bl', label: 'Blue' }).expect(201)

    const length = await createDefinition({
      name: 'E2E Saved Def - Length',
      label: 'Length (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 3, min: 10, max: 500 },
      meaningTemplate: 'Length: {value} mm',
    }).expect(201)
    const dLength = (length.body as ApiResponse<SegmentDefinition>).data.id

    // ── Products ────────────────────────────────────────────────────────
    const mainProduct = await createProduct({
      name: MAIN_NAME,
      slug: MAIN_SLUG,
      codePrefix: 'SAV',
      isPublished: true,
    }).expect(201)
    const mainId = (mainProduct.body as ApiResponse<ConfigurableProduct>).data
      .id

    await createProduct({
      name: 'E2E Saved Unpublished Product',
      slug: UNPUBLISHED_SLUG,
      codePrefix: 'UNP',
      isPublished: false,
    }).expect(201)

    // ── Assignments ─────────────────────────────────────────────────────
    const rColor = await createAssignment(mainId, {
      definitionId: dColor,
    }).expect(201)
    aColor = (rColor.body as ApiResponse<ProductSegmentAssignment>).data.id
    const rLength = await createAssignment(mainId, {
      definitionId: dLength,
    }).expect(201)
    aLength = (rLength.body as ApiResponse<ProductSegmentAssignment>).data.id
  })

  afterAll(async () => {
    // Users first so their saved configurations cascade away before the
    // referenced product rows go (productId would SET NULL anyway, but this
    // keeps the order symmetric with the pre-cleanup).
    await cleanupUsers(dataSource, EMAILS)
    for (const slug of PRODUCT_SLUGS) {
      await configurableProductRepo.delete({ slug })
    }
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await app.close()
  })

  // ── POST /configurators/:slug/save ──────────────────────────────────────

  describe('POST /configurators/:slug/save', () => {
    it('401s without a token (unlike its sibling resolve route)', async () => {
      await request(app.getHttpServer())
        .post(`/configurators/${MAIN_SLUG}/save`)
        .send({ selections: validSelections() })
        .expect(401)
    })

    it('saves a snapshot of a valid resolve for the calling user', async () => {
      const res = await save(ownerToken, validSelections()).expect(201)
      const snapshot = (res.body as ApiResponse<SavedConfiguration>).data

      expect(snapshot.id).toEqual(expect.any(Number))
      expect(snapshot.userId).toBe(ownerId)
      expect(snapshot.productId).toEqual(expect.any(Number))
      expect(snapshot.productName).toBe(MAIN_NAME)
      expect(snapshot.code).toBe(EXPECTED_CODE)
      expect(snapshot.summary).toEqual(EXPECTED_SUMMARY)
      expect(snapshot.selections).toEqual(validSelections())
      expect(snapshot.quoteRequestedAt).toBeNull()
    })

    it('400s when the resolve is invalid, with the resolver error messages', async () => {
      // Missing both required segments.
      const missing = await save(ownerToken, {}).expect(400)
      expect(
        (missing.body as { message: string[] }).message.join(' '),
      ).toContain('required')

      // Unknown SELECT value.
      await save(ownerToken, validSelections()).expect(201)
      const badValue = await save(ownerToken, {
        ...validSelections(),
        [aColor]: 'xx',
      }).expect(400)
      expect(
        (badValue.body as { message: string[] }).message.join(' '),
      ).toContain('not a valid option')
    })

    it('400s on malformed selection shapes', async () => {
      // selections is not an object.
      await save(ownerToken, 'x' as unknown as Record<string, unknown>).expect(
        400,
      )
      // Non-integer key.
      await save(ownerToken, { abc: '1' }).expect(400)
      // Non-string value.
      await save(ownerToken, { [aColor]: 5 }).expect(400)
    })

    it('404s for an unknown or unpublished slug', async () => {
      await save(
        ownerToken,
        validSelections(),
        'e2e-configurator-saved-ghost',
      ).expect(404)
      await save(ownerToken, validSelections(), UNPUBLISHED_SLUG).expect(404)
    })
  })

  // ── GET /saved-configurations ───────────────────────────────────────────

  describe('GET /saved-configurations', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations')
        .expect(401)
    })

    it('lists only the caller-owned snapshots, newest first', async () => {
      const first = await saveValid(ownerToken)
      const second = await saveValid(ownerToken)
      const foreign = await saveValid(otherToken)

      const res = await request(app.getHttpServer())
        .get('/saved-configurations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<SavedConfiguration>>).data

      // Every row belongs to the owner — the other user's snapshot is absent.
      expect(page.data.length).toBeGreaterThanOrEqual(2)
      expect(page.data.every((row) => row.userId === ownerId)).toBe(true)
      const ids = page.data.map((row) => row.id)
      expect(ids).not.toContain(foreign.id)

      // Newest first: the second snapshot appears before the first.
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id))
    })

    it('paginates with the shared meta/links shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/saved-configurations')
        .query({ limit: 1, page: 1 })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<SavedConfiguration>>).data

      expect(page.data).toHaveLength(1)
      expect(page.meta.itemsPerPage).toBe(1)
      // The owner's rows are private to this suite, so a real lower bound is
      // safe — but never assert exact totals on a shared database.
      expect(page.meta.totalItems).toBeGreaterThanOrEqual(2)
      expect(page.links.current).toContain('limit=1')
    })
  })

  // ── GET /saved-configurations/:id ───────────────────────────────────────

  describe('GET /saved-configurations/:id', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/1')
        .expect(401)
    })

    it('returns a caller-owned snapshot', async () => {
      const created = await saveValid(ownerToken)

      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const snapshot = (res.body as ApiResponse<SavedConfiguration>).data

      expect(snapshot.id).toBe(created.id)
      expect(snapshot.code).toBe(EXPECTED_CODE)
      expect(snapshot.summary).toEqual(EXPECTED_SUMMARY)
    })

    it("404s for another user's snapshot — indistinguishable from missing", async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
    })

    it('404s for a missing id', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/999999')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404)
    })
  })

  // ── DELETE /saved-configurations/:id ────────────────────────────────────

  describe('DELETE /saved-configurations/:id', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .delete('/saved-configurations/1')
        .expect(401)
    })

    it("404s for another user's snapshot and leaves it intact", async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .delete(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)

      // Still readable by its real owner.
      await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
    })

    it('deletes a caller-owned snapshot', async () => {
      const created = await saveValid(ownerToken)

      const res = await request(app.getHttpServer())
        .delete(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      expect((res.body as ApiResponse<{ deleted: boolean }>).data).toEqual({
        deleted: true,
        id: created.id,
      })

      await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404)
    })

    it('404s for a missing id', async () => {
      await request(app.getHttpServer())
        .delete('/saved-configurations/999999')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404)
    })
  })

  // ── POST /saved-configurations/:id/request-quote ────────────────────────

  describe('POST /saved-configurations/:id/request-quote', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .post('/saved-configurations/1/request-quote')
        .expect(401)
    })

    it('stamps quoteRequestedAt and returns the updated snapshot', async () => {
      const created = await saveValid(ownerToken)
      expect(created.quoteRequestedAt).toBeNull()

      const res = await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const snapshot = (res.body as ApiResponse<SavedConfiguration>).data

      expect(snapshot.id).toBe(created.id)
      expect(snapshot.quoteRequestedAt).toEqual(expect.any(String))
      expect(new Date(snapshot.quoteRequestedAt!).toString()).not.toBe(
        'Invalid Date',
      )
      expect(snapshot.code).toBe(EXPECTED_CODE)
      expect(snapshot.summary).toEqual(EXPECTED_SUMMARY)
      expect(snapshot.productName).toBe(MAIN_NAME)
    })

    it('sends the quote-request mail with the requester and snapshot details', async () => {
      const created = await saveValid(ownerToken)
      sendQuoteRequestMailMock.mockClear()

      await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      expect(sendQuoteRequestMailMock).toHaveBeenCalledTimes(1)
      expect(sendQuoteRequestMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          savedConfigurationId: created.id,
          userEmail: OWNER_EMAIL,
          userFirstName: 'ConfiguratorSavedOwner',
          productName: MAIN_NAME,
          code: EXPECTED_CODE,
          summary: EXPECTED_SUMMARY,
        }),
      )
    })

    it('404s for a missing id', async () => {
      await request(app.getHttpServer())
        .post('/saved-configurations/999999/request-quote')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404)
    })

    it("404s for another user's snapshot — indistinguishable from missing", async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
    })

    it('409s on a second request-quote call and does not re-send mail', async () => {
      const created = await saveValid(ownerToken)
      sendQuoteRequestMailMock.mockClear()

      await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const second = await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409)
      expect((second.body as { message: string }).message).toContain('already')

      expect(sendQuoteRequestMailMock).toHaveBeenCalledTimes(1)
    })
  })

  // ── GET /saved-configurations/admin (admin quote-request inbox) ─────────

  describe('GET /saved-configurations/admin', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .expect(401)
    })

    it('403s for a non-admin role', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403)
    })

    it('only returns rows where a quote was requested, newest request first', async () => {
      const notRequested = await saveValid(ownerToken)

      const first = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${first.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const second = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${second.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const res = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<SavedConfiguration>>).data
      const ids = page.data.map((row) => row.id)

      expect(ids).not.toContain(notRequested.id)
      expect(ids).toContain(first.id)
      expect(ids).toContain(second.id)
      expect(page.data.every((row) => row.quoteRequestedAt !== null)).toBe(true)
      // Newest request first.
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id))
    })

    it('?quoteReviewed= narrows to reviewed/unreviewed requests', async () => {
      const reviewed = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${reviewed.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      await request(app.getHttpServer())
        .patch(`/saved-configurations/admin/${reviewed.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quoteReviewed: true })
        .expect(200)

      const unreviewed = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${unreviewed.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const reviewedRes = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ quoteReviewed: 'true', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const reviewedIds = (
        reviewedRes.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.map((row) => row.id)
      expect(reviewedIds).toContain(reviewed.id)
      expect(reviewedIds).not.toContain(unreviewed.id)

      const unreviewedRes = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ quoteReviewed: 'false', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const unreviewedIds = (
        unreviewedRes.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.map((row) => row.id)
      expect(unreviewedIds).toContain(unreviewed.id)
      expect(unreviewedIds).not.toContain(reviewed.id)
    })

    it('embeds the requester identity on each row', async () => {
      const created = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const res = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const page = (res.body as ApiResponse<Paginated<SavedConfiguration>>).data
      const row = page.data.find((r) => r.id === created.id)

      expect(row?.requester).toEqual({
        id: ownerId,
        firstName: 'ConfiguratorSavedOwner',
        lastName: null,
        email: OWNER_EMAIL,
      })
    })

    it('?startDate=/?endDate= narrows by quoteRequestedAt date range', async () => {
      const inRange = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${inRange.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10)
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(0, 10)

      const withinRes = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ startDate: yesterday, endDate: tomorrow, limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const withinIds = (
        withinRes.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.map((row) => row.id)
      expect(withinIds).toContain(inRange.id)

      const outsideRes = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ endDate: yesterday, limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const outsideIds = (
        outsideRes.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.map((row) => row.id)
      expect(outsideIds).not.toContain(inRange.id)
    })

    it('?email= narrows to a case-insensitive substring match on the requester email', async () => {
      const created = await saveValid(ownerToken)
      await request(app.getHttpServer())
        .post(`/saved-configurations/${created.id}/request-quote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)

      const matchRes = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ email: 'CONFIGURATOR-SAVED-OWNER', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const matchIds = (
        matchRes.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.map((row) => row.id)
      expect(matchIds).toContain(created.id)

      const noMatchRes = await request(app.getHttpServer())
        .get('/saved-configurations/admin')
        .query({ email: 'configurator-saved-other', limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const noMatchIds = (
        noMatchRes.body as ApiResponse<Paginated<SavedConfiguration>>
      ).data.data.map((row) => row.id)
      expect(noMatchIds).not.toContain(created.id)
    })
  })

  // ── GET /saved-configurations/admin/:id ──────────────────────────────────

  describe('GET /saved-configurations/admin/:id', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/admin/1')
        .expect(401)
    })

    it('403s for a non-admin role', async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .get(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403)
    })

    it("returns any user's snapshot, unlike the owner-scoped route", async () => {
      const created = await saveValid(ownerToken)

      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const snapshot = (res.body as ApiResponse<SavedConfiguration>).data

      expect(snapshot.id).toBe(created.id)
      expect(snapshot.userId).toBe(ownerId)
    })

    it('embeds the requester identity', async () => {
      const created = await saveValid(ownerToken)

      const res = await request(app.getHttpServer())
        .get(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const snapshot = (res.body as ApiResponse<SavedConfiguration>).data

      expect(snapshot.requester).toEqual({
        id: ownerId,
        firstName: 'ConfiguratorSavedOwner',
        lastName: null,
        email: OWNER_EMAIL,
      })
    })

    it('404s for a missing id', async () => {
      await request(app.getHttpServer())
        .get('/saved-configurations/admin/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })
  })

  // ── PATCH /saved-configurations/admin/:id ────────────────────────────────

  describe('PATCH /saved-configurations/admin/:id', () => {
    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .patch('/saved-configurations/admin/1')
        .send({ quoteReviewed: true })
        .expect(401)
    })

    it('403s for a non-admin role', async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .patch(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ quoteReviewed: true })
        .expect(403)
    })

    it('missing quoteReviewed in body → 400', async () => {
      const created = await saveValid(ownerToken)

      await request(app.getHttpServer())
        .patch(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400)
    })

    it('404s for a missing id', async () => {
      await request(app.getHttpServer())
        .patch('/saved-configurations/admin/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quoteReviewed: true })
        .expect(404)
    })

    it('toggles quoteReviewed and writes an AuditLog row', async () => {
      const created = await saveValid(ownerToken)
      expect(created.quoteReviewed).toBe(false)

      const res = await request(app.getHttpServer())
        .patch(`/saved-configurations/admin/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quoteReviewed: true })
        .expect(200)
      const snapshot = (res.body as ApiResponse<SavedConfiguration>).data
      expect(snapshot.quoteReviewed).toBe(true)

      const row: SavedConfiguration | null = await dataSource
        .getRepository(SavedConfiguration)
        .findOneBy({ id: created.id })
      expect(row!.quoteReviewed).toBe(true)

      const auditRow: AuditLog | null = await auditLogRepo.findOneBy({
        entity: 'SavedConfiguration',
        entityId: created.id,
        action: AuditAction.UPDATE,
      })
      expect(auditRow).not.toBeNull()
    })
  })

  // ── Snapshot immutability (CONFIGURATOR.md §2.5) ───────────────────────
  // Runs last: it edits the shared fixture (option label) and soft-deletes
  // the main product, which would break the save tests above.

  describe('snapshot immutability', () => {
    it('keeps code and summary frozen through admin edits and product deletion', async () => {
      const created = await saveValid(ownerToken)

      // Admin renames the "Red" option — live config changes, snapshot must not.
      await request(app.getHttpServer())
        .patch(`/configurator-options/${optRedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'Crimson' })
        .expect(200)

      const afterEdit = await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const editSnapshot = (afterEdit.body as ApiResponse<SavedConfiguration>)
        .data
      expect(editSnapshot.code).toBe(EXPECTED_CODE)
      expect(editSnapshot.summary).toEqual(EXPECTED_SUMMARY)

      // Admin soft-deletes the whole product — the snapshot still reads back
      // unchanged (productId is only SET NULL on a hard delete).
      const productId = created.productId as number
      await request(app.getHttpServer())
        .delete(`/configurator-products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const afterDelete = await request(app.getHttpServer())
        .get(`/saved-configurations/${created.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
      const deleteSnapshot = (
        afterDelete.body as ApiResponse<SavedConfiguration>
      ).data
      expect(deleteSnapshot.productName).toBe(MAIN_NAME)
      expect(deleteSnapshot.code).toBe(EXPECTED_CODE)
      expect(deleteSnapshot.summary).toEqual(EXPECTED_SUMMARY)
      expect(deleteSnapshot.selections).toEqual(validSelections())

      // And saving against the now-deleted product 404s.
      await save(ownerToken, validSelections()).expect(404)
    })
  })
})
