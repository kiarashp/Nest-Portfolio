import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { SegmentDataType } from '../../src/configurator/enums/segment-data-type.enum'
import { SegmentDefinition } from '../../src/configurator/entities/segment-definition.entity'
import { ConfigurableProduct } from '../../src/configurator/entities/configurable-product.entity'
import { ProductSegmentAssignment } from '../../src/configurator/entities/product-segment-assignment.entity'
import { ConfiguratorFormSchemaDto } from '../../src/configurator/dtos/configurator-form-schema.dto'
import { ResolveResultDto } from '../../src/configurator/dtos/resolve-result.dto'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Exercises the public configurator surface (CONFIGURATOR.md §5.2/§7 Step 5):
// GET /configurators/:slug (form schema) and POST /configurators/:slug/resolve
// (the resolver). Fixtures replicate the §6 worked example ("Resistive sensor
// with cap", prefix FRH) and are built through the real admin HTTP APIs; all
// public requests are sent without a token.
describe('Configurator public resolve (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string

  let segmentDefinitionRepo: Repository<SegmentDefinition>
  let configurableProductRepo: Repository<ConfigurableProduct>

  const ADMIN_EMAIL = 'configurator-resolve-admin@e2e.test'
  const PASSWORD = 'Password1!'

  const MAIN_SLUG = 'e2e-configurator-resolve-frh'
  const UNPUBLISHED_SLUG = 'e2e-configurator-resolve-unpublished'
  const DELETED_SLUG = 'e2e-configurator-resolve-deleted'
  const STRING_SLUG = 'e2e-configurator-resolve-string'
  const PRODUCT_SLUGS = [MAIN_SLUG, UNPUBLISHED_SLUG, DELETED_SLUG, STRING_SLUG]

  const DEFINITION_NAMES = [
    'E2E Resolve Def - Sensor Type',
    'E2E Resolve Def - Has Extension',
    'E2E Resolve Def - Extension Length',
    'E2E Resolve Def - Extension Diameter',
    'E2E Resolve Def - Insertion Length',
    'E2E Resolve Def - String Marker',
  ]

  // Assignment ids of the §6 fixture, captured while seeding — a1..a5 are
  // positions 1..5 of the main product, aStr the single string segment.
  let a1: number
  let a2: number
  let a3: number
  let a4: number
  let a5: number
  let aStr: number

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

  // Public endpoints — deliberately no Authorization header.
  const getSchema = (slug: string) =>
    request(app.getHttpServer()).get(`/configurators/${slug}`)

  const resolve = (slug: string, selections: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/configurators/${slug}/resolve`)
      .send({ selections })

  // Builds the §6 happy-path selections, keyed by real assignment ids, with
  // per-test overrides merged in.
  const mainSelections = (
    overrides: Record<string, string> = {},
  ): Record<string, string> => ({
    [a1]: '2d',
    [a2]: 'yes',
    [a3]: '45',
    [a4]: '300',
    [a5]: '450',
    ...overrides,
  })

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    segmentDefinitionRepo = dataSource.getRepository(SegmentDefinition)
    configurableProductRepo = dataSource.getRepository(ConfigurableProduct)

    // Pre-cleanup: products first (cascades their assignments), then
    // definitions, so a previous failed run never leaves FK/unique conflicts.
    // withDeleted-style lookup is unnecessary — repo.delete() ignores the
    // soft-delete column and removes soft-deleted rows too.
    for (const slug of PRODUCT_SLUGS) {
      await configurableProductRepo.delete({ slug })
    }
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorResolveAdmin',
      role: UserRole.ADMIN,
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)

    // ── Definitions (§6 fixture) ────────────────────────────────────────
    const sensorType = await createDefinition({
      name: 'E2E Resolve Def - Sensor Type',
      label: 'Sensor type',
      dataType: SegmentDataType.SELECT,
      meaningTemplate: 'Sensor: {label}',
    }).expect(201)
    const d1 = (sensorType.body as ApiResponse<SegmentDefinition>).data.id
    await createOption(d1, { value: '1m', label: 'single Pt100' }).expect(201)
    await createOption(d1, { value: '2m', label: 'double Pt100' }).expect(201)
    await createOption(d1, { value: '1d', label: 'Pt500' }).expect(201)
    await createOption(d1, { value: '2d', label: 'double Pt500' }).expect(201)

    const hasExtension = await createDefinition({
      name: 'E2E Resolve Def - Has Extension',
      label: 'Has extension?',
      dataType: SegmentDataType.SELECT,
      meaningTemplate: 'Extension: {label}',
    }).expect(201)
    const d2 = (hasExtension.body as ApiResponse<SegmentDefinition>).data.id
    await createOption(d2, { value: 'yes', label: 'with extension' }).expect(
      201,
    )
    await createOption(d2, { value: 'no', label: 'without extension' }).expect(
      201,
    )

    const extensionLength = await createDefinition({
      name: 'E2E Resolve Def - Extension Length',
      label: 'Extension length (cm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 2, min: 10, max: 99 },
      meaningTemplate: 'Extension length: {value} cm',
    }).expect(201)
    const d3 = (extensionLength.body as ApiResponse<SegmentDefinition>).data.id

    const extensionDiameter = await createDefinition({
      name: 'E2E Resolve Def - Extension Diameter',
      label: 'Extension diameter (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 3, min: 100, max: 800 },
      meaningTemplate: 'Extension diameter: {value} mm',
    }).expect(201)
    const d4 = (extensionDiameter.body as ApiResponse<SegmentDefinition>).data
      .id

    const insertionLength = await createDefinition({
      name: 'E2E Resolve Def - Insertion Length',
      label: 'Insertion length (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 4, min: 50, max: 2000 },
      meaningTemplate: 'Insertion length: {value} mm',
    }).expect(201)
    const d5 = (insertionLength.body as ApiResponse<SegmentDefinition>).data.id

    const stringMarker = await createDefinition({
      name: 'E2E Resolve Def - String Marker',
      label: 'Marker',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1, maxLength: 5 },
      meaningTemplate: 'Marker: {value}',
    }).expect(201)
    const d6 = (stringMarker.body as ApiResponse<SegmentDefinition>).data.id

    // ── Products ────────────────────────────────────────────────────────
    const mainProduct = await createProduct({
      name: 'E2E Resolve Main Product',
      slug: MAIN_SLUG,
      codePrefix: 'FRH',
      description: 'Resistive sensor with cap',
      isPublished: true,
    }).expect(201)
    const mainId = (mainProduct.body as ApiResponse<ConfigurableProduct>).data
      .id

    await createProduct({
      name: 'E2E Resolve Unpublished Product',
      slug: UNPUBLISHED_SLUG,
      codePrefix: 'UNP',
      isPublished: false,
    }).expect(201)

    const deletedProduct = await createProduct({
      name: 'E2E Resolve Deleted Product',
      slug: DELETED_SLUG,
      codePrefix: 'DEL',
      isPublished: true,
    }).expect(201)
    const deletedId = (deletedProduct.body as ApiResponse<ConfigurableProduct>)
      .data.id
    await request(app.getHttpServer())
      .delete(`/configurator-products/${deletedId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const stringProduct = await createProduct({
      name: 'E2E Resolve String Product',
      slug: STRING_SLUG,
      codePrefix: 'STR',
      isPublished: true,
    }).expect(201)
    const stringId = (stringProduct.body as ApiResponse<ConfigurableProduct>)
      .data.id

    // ── Assignments (§6 positions 1-5, conditions inline) ───────────────
    // Each controller is created before its dependent (append order), so the
    // dependent's condition can reference the controller's real id inline.
    const r1 = await createAssignment(mainId, { definitionId: d1 }).expect(201)
    a1 = (r1.body as ApiResponse<ProductSegmentAssignment>).data.id
    const r2 = await createAssignment(mainId, { definitionId: d2 }).expect(201)
    a2 = (r2.body as ApiResponse<ProductSegmentAssignment>).data.id
    const r3 = await createAssignment(mainId, {
      definitionId: d3,
      condition: {
        controllingAssignmentId: a2,
        operator: 'eq',
        value: 'yes',
        effect: 'zero_fill',
      },
    }).expect(201)
    a3 = (r3.body as ApiResponse<ProductSegmentAssignment>).data.id
    const r4 = await createAssignment(mainId, {
      definitionId: d4,
      condition: {
        controllingAssignmentId: a3,
        operator: 'between',
        min: 30,
        max: 99,
        effect: 'zero_fill',
      },
    }).expect(201)
    a4 = (r4.body as ApiResponse<ProductSegmentAssignment>).data.id
    const r5 = await createAssignment(mainId, { definitionId: d5 }).expect(201)
    a5 = (r5.body as ApiResponse<ProductSegmentAssignment>).data.id

    const rStr = await createAssignment(stringId, {
      definitionId: d6,
    }).expect(201)
    aStr = (rStr.body as ApiResponse<ProductSegmentAssignment>).data.id
  })

  afterAll(async () => {
    for (const slug of PRODUCT_SLUGS) {
      await configurableProductRepo.delete({ slug })
    }
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL])
    await app.close()
  })

  // ── GET /configurators/:slug ──────────────────────────────────────────

  describe('GET /configurators/:slug', () => {
    it('returns the curated form schema for a published configurator', async () => {
      const res = await getSchema(MAIN_SLUG).expect(200)
      const schema = (res.body as ApiResponse<ConfiguratorFormSchemaDto>).data

      // Product header: exactly the §5.2 fields, nothing internal.
      expect(schema.product).toEqual({
        name: 'E2E Resolve Main Product',
        description: 'Resistive sensor with cap',
        imageUrl: null,
        codePrefix: 'FRH',
        separator: '-',
      })

      expect(schema.segments).toHaveLength(5)
      expect(schema.segments.map((segment) => segment.position)).toEqual([
        1, 2, 3, 4, 5,
      ])
      expect(schema.segments.map((segment) => segment.assignmentId)).toEqual([
        a1,
        a2,
        a3,
        a4,
        a5,
      ])
    })

    it('exposes options as {value, label} for SELECT segments only', async () => {
      const res = await getSchema(MAIN_SLUG).expect(200)
      const schema = (res.body as ApiResponse<ConfiguratorFormSchemaDto>).data

      expect(schema.segments[0].options).toEqual([
        { value: '1m', label: 'single Pt100' },
        { value: '2m', label: 'double Pt100' },
        { value: '1d', label: 'Pt500' },
        { value: '2d', label: 'double Pt500' },
      ])
      expect(schema.segments[1].options).toEqual([
        { value: 'yes', label: 'with extension' },
        { value: 'no', label: 'without extension' },
      ])
      expect(schema.segments[2].options).toBeUndefined()
      expect(schema.segments[3].options).toBeUndefined()
      expect(schema.segments[4].options).toBeUndefined()
    })

    it('exposes constraints and conditions so the frontend can mirror the rules', async () => {
      const res = await getSchema(MAIN_SLUG).expect(200)
      const schema = (res.body as ApiResponse<ConfiguratorFormSchemaDto>).data

      expect(schema.segments[2]).toMatchObject({
        label: 'Extension length (cm)',
        dataType: SegmentDataType.NUMBER,
        constraints: { digits: 2, min: 10, max: 99 },
        condition: {
          controllingAssignmentId: a2,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
      })
      expect(schema.segments[3].condition).toMatchObject({
        controllingAssignmentId: a3,
        operator: 'between',
        min: 30,
        max: 99,
      })
      expect(schema.segments[0].condition).toBeNull()
      expect(schema.segments[4].condition).toBeNull()
    })

    it('404s for an unknown slug', async () => {
      await getSchema('e2e-configurator-resolve-ghost').expect(404)
    })

    it('404s for an unpublished configurator', async () => {
      await getSchema(UNPUBLISHED_SLUG).expect(404)
    })

    it('404s for a soft-deleted configurator', async () => {
      await getSchema(DELETED_SLUG).expect(404)
    })
  })

  // ── POST /configurators/:slug/resolve ─────────────────────────────────

  describe('POST /configurators/:slug/resolve', () => {
    it('resolves the full happy path (§6 bullet 1)', async () => {
      const res = await resolve(MAIN_SLUG, mainSelections()).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.code).toBe('FRH-2d-yes-45-300-0450')
      expect(result.summary).toEqual([
        'Sensor: double Pt500',
        'Extension: with extension',
        'Extension length: 45 cm',
        'Extension diameter: 300 mm',
        'Insertion length: 0450 mm',
      ])
      expect(result.segments).toHaveLength(5)
      expect(result.segments.every((segment) => segment.active)).toBe(true)
    })

    it('cascades zero-fill down the chain when the controller is "no" (§6 bullet 2)', async () => {
      const res = await resolve(MAIN_SLUG, {
        [a1]: '2d',
        [a2]: 'no',
        [a5]: '450',
      }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.code).toBe('FRH-2d-no-00-000-0450')
      expect(result.summary).toEqual([
        'Sensor: double Pt500',
        'Extension: without extension',
        'Insertion length: 0450 mm',
      ])
      expect(result.segments[2]).toMatchObject({ active: false, value: '00' })
      expect(result.segments[3]).toMatchObject({ active: false, value: '000' })
    })

    it('zero-fills a dependent when between is not met and ignores its supplied value (§6 bullet 3)', async () => {
      const res = await resolve(
        MAIN_SLUG,
        mainSelections({ [a3]: '15' }),
      ).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.code).toBe('FRH-2d-yes-15-000-0450')
      expect(result.segments[3]).toMatchObject({ active: false, value: '000' })
    })

    it('ignores a value supplied for a zero-filled segment without erroring (§6 bullet 4)', async () => {
      const res = await resolve(MAIN_SLUG, {
        [a1]: '2d',
        [a2]: 'no',
        [a3]: '45',
        [a5]: '450',
      }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.code).toBe('FRH-2d-no-00-000-0450')
    })

    it('normalizes NUMBER values by zero-padding (§6 bullet 5)', async () => {
      const res = await resolve(MAIN_SLUG, {
        [a1]: '1m',
        [a2]: 'no',
        [a5]: '50',
      }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.code).toBe('FRH-1m-no-00-000-0050')
    })

    it('rejects a value above max and omits code/summary (§6 bullet 5)', async () => {
      const res = await resolve(
        MAIN_SLUG,
        mainSelections({ [a5]: '2001' }),
      ).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].assignmentId).toBe(a5)
      expect(result.errors[0].message).toContain('at most 2000')
      expect(result).not.toHaveProperty('code')
      expect(result).not.toHaveProperty('summary')
      expect(result.segments).toHaveLength(5)
    })

    it('rejects an unknown SELECT value', async () => {
      const res = await resolve(
        MAIN_SLUG,
        mainSelections({ [a1]: 'xx' }),
      ).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toMatchObject({ assignmentId: a1 })
      expect(result.errors[0].message).toContain('not a valid option')
    })

    it('errors a missing required active segment and zero-fills its dependent', async () => {
      const res = await resolve(MAIN_SLUG, {
        [a1]: '2d',
        [a2]: 'yes',
        [a5]: '450',
      }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({ assignmentId: a3 })
      expect(result.errors[0].message).toContain('required')
      // a4 watches the errored a3 — it zero-fills instead of erroring too.
      expect(result.segments[3]).toMatchObject({ active: false, value: '000' })
    })

    it('collects every validation failure in one response', async () => {
      const res = await resolve(MAIN_SLUG, {
        [a1]: 'xx',
        [a2]: 'yes',
        [a3]: '5',
        [a5]: '9999',
      }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(false)
      const erroredIds = result.errors
        .map((error) => error.assignmentId)
        .sort((left, right) => left - right)
      expect(erroredIds).toEqual(
        [a1, a3, a5].sort((left, right) => left - right),
      )
    })

    it('silently ignores selection keys that match no assignment', async () => {
      const res = await resolve(
        MAIN_SLUG,
        mainSelections({ '999999': 'stale' }),
      ).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.code).toBe('FRH-2d-yes-45-300-0450')
    })

    it('rejects the reserved STRING value "0"', async () => {
      const res = await resolve(STRING_SLUG, { [aStr]: '0' }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toMatchObject({ assignmentId: aStr })
      expect(result.errors[0].message).toContain('reserved')
    })

    it('resolves a STRING segment happy path', async () => {
      const res = await resolve(STRING_SLUG, { [aStr]: 'abc' }).expect(200)
      const result = (res.body as ApiResponse<ResolveResultDto>).data

      expect(result.valid).toBe(true)
      expect(result.code).toBe('STR-abc')
      expect(result.summary).toEqual(['Marker: abc'])
    })

    it('404s when resolving an unpublished configurator', async () => {
      await resolve(UNPUBLISHED_SLUG, {}).expect(404)
    })

    it('400s on malformed request shapes', async () => {
      // Missing selections entirely.
      await request(app.getHttpServer())
        .post(`/configurators/${MAIN_SLUG}/resolve`)
        .send({})
        .expect(400)
      // selections is not an object.
      await request(app.getHttpServer())
        .post(`/configurators/${MAIN_SLUG}/resolve`)
        .send({ selections: 'x' })
        .expect(400)
      // Non-integer key.
      await resolve(MAIN_SLUG, { abc: '1' }).expect(400)
      // Non-string value.
      await resolve(MAIN_SLUG, { [a1]: 5 }).expect(400)
    })
  })
})
