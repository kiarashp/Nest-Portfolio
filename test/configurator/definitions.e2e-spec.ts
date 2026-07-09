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
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

interface Paginated<T> {
  data: T[]
  meta: {
    itemsPerPage: number
    totalItems: number
    currentPage: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  links: Record<string, string>
}

// Exercises the admin CRUD surface for the segment-definition library and its
// options (CONFIGURATOR.md §5.1/§7 Step 2). The "assigned" guard paths (dataType
// immutability, delete-definition RESTRICT, delete-option-below-2) can't be
// reached through the HTTP API yet — ProductSegmentAssignment creation is Step 4
// — so this suite seeds a ConfigurableProduct + ProductSegmentAssignment row
// directly through the repositories, the same way seedUser bypasses the HTTP
// layer for user fixtures.
describe('Configurator segment definitions (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string

  let segmentDefinitionRepo: Repository<SegmentDefinition>
  let segmentOptionRepo: Repository<SegmentOption>
  let configurableProductRepo: Repository<ConfigurableProduct>
  let assignmentRepo: Repository<ProductSegmentAssignment>

  const ADMIN_EMAIL = 'configurator-definitions-admin@e2e.test'
  const USER_EMAIL = 'configurator-definitions-user@e2e.test'
  const PASSWORD = 'Password1!'

  const PRODUCT_SLUG = 'e2e-configurator-assigned-product'
  const DEFINITION_NAMES = [
    'E2E Configurator Def - String',
    'E2E Configurator Def - Number',
    'E2E Configurator Def - Select',
    'E2E Configurator Def - Dup Name',
    'E2E Configurator Def - Delete Me',
    'E2E Configurator Def - DataType Guard',
    'E2E Configurator Def - Option Guard Assigned',
    'E2E Configurator Def - Option Guard Free',
    'E2E Configurator Def - Not Found 404',
    'E2E Configurator Def - Update Options',
  ]

  // IDs threaded across tests within a section, mirroring
  // product-types-evolution.e2e-spec.ts's typeId/productId pattern.
  let stringDefId: number
  let numberDefId: number
  let selectDefId: number
  let dataTypeGuardDefId: number
  let assignedProductId: number

  const createDefinition = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/configurator-definitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    segmentDefinitionRepo = dataSource.getRepository(SegmentDefinition)
    segmentOptionRepo = dataSource.getRepository(SegmentOption)
    configurableProductRepo = dataSource.getRepository(ConfigurableProduct)
    assignmentRepo = dataSource.getRepository(ProductSegmentAssignment)

    // Pre-cleanup: remove rows left by a previous failed run. Deleting the
    // product first cascades its assignments (onDelete: CASCADE on productId),
    // which frees the definitions to be deleted (their options cascade too).
    await configurableProductRepo.delete({ slug: PRODUCT_SLUG })
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorUser',
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    // Seed a ConfigurableProduct directly (no API for it until Step 3) so the
    // "assigned" guard paths below have a real product to attach assignments to.
    const product = await configurableProductRepo.save(
      configurableProductRepo.create({
        name: 'E2E Configurator Assigned Product',
        slug: PRODUCT_SLUG,
        codePrefix: 'E2E',
      }),
    )
    assignedProductId = product.id
  })

  afterAll(async () => {
    await configurableProductRepo.delete({ slug: PRODUCT_SLUG })
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── POST /configurator-definitions ──────────────────────────────────────

  it('creates a STRING definition → 201', async () => {
    const res = await createDefinition({
      name: 'E2E Configurator Def - String',
      label: 'Serial suffix',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1, maxLength: 5 },
      meaningTemplate: 'Suffix: {value}',
    }).expect(201)

    const def = (res.body as ApiResponse<SegmentDefinition>).data
    expect(def.id).toBeDefined()
    expect(def.dataType).toBe(SegmentDataType.STRING)
    expect(def.constraints).toEqual({ minLength: 1, maxLength: 5 })
    stringDefId = def.id
  })

  it('creates a NUMBER definition → 201', async () => {
    const res = await createDefinition({
      name: 'E2E Configurator Def - Number',
      label: 'Insertion length (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 4, min: 50, max: 2000 },
      meaningTemplate: 'Insertion length: {value} mm',
    }).expect(201)

    const def = (res.body as ApiResponse<SegmentDefinition>).data
    expect(def.constraints).toEqual({ digits: 4, min: 50, max: 2000 })
    numberDefId = def.id
  })

  it('creates a SELECT definition with no constraints → 201', async () => {
    const res = await createDefinition({
      name: 'E2E Configurator Def - Select',
      label: 'Sensor type',
      dataType: SegmentDataType.SELECT,
      meaningTemplate: 'Sensor: {label}',
    }).expect(201)

    const def = (res.body as ApiResponse<SegmentDefinition>).data
    expect(def.constraints).toEqual({})
    selectDefId = def.id
  })

  it('rejects STRING constraints missing a required key → 400', async () => {
    await createDefinition({
      name: 'E2E Configurator Def - Bad String',
      label: 'Bad',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1 },
      meaningTemplate: '{value}',
    }).expect(400)
  })

  it('rejects constraints with an unknown key for the dataType → 400', async () => {
    await createDefinition({
      name: 'E2E Configurator Def - Bad Number',
      label: 'Bad',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 4, min: 1, max: 10, pattern: '^[a-z]+$' },
      meaningTemplate: '{value}',
    }).expect(400)
  })

  it('rejects a SELECT definition with non-empty constraints → 400', async () => {
    await createDefinition({
      name: 'E2E Configurator Def - Bad Select',
      label: 'Bad',
      dataType: SegmentDataType.SELECT,
      constraints: { minLength: 1 },
      meaningTemplate: '{label}',
    }).expect(400)
  })

  it('rejects a duplicate name → 409', async () => {
    await createDefinition({
      name: 'E2E Configurator Def - Dup Name',
      label: 'First',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1, maxLength: 5 },
      meaningTemplate: '{value}',
    }).expect(201)

    await createDefinition({
      name: 'E2E Configurator Def - Dup Name',
      label: 'Second',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1, maxLength: 5 },
      meaningTemplate: '{value}',
    }).expect(409)
  })

  it('rejects an anonymous request → 401', async () => {
    await request(app.getHttpServer())
      .post('/configurator-definitions')
      .send({
        name: 'E2E No Auth',
        label: 'x',
        dataType: SegmentDataType.STRING,
        constraints: { minLength: 1, maxLength: 5 },
        meaningTemplate: '{value}',
      })
      .expect(401)
  })

  it('rejects a non-admin request → 403', async () => {
    await request(app.getHttpServer())
      .post('/configurator-definitions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'E2E User Attempt',
        label: 'x',
        dataType: SegmentDataType.STRING,
        constraints: { minLength: 1, maxLength: 5 },
        meaningTemplate: '{value}',
      })
      .expect(403)
  })

  // ── GET /configurator-definitions ───────────────────────────────────────

  it('lists definitions, paginated → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/configurator-definitions')
      .query({ limit: 1, page: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<SegmentDefinition>>).data
    expect(body.data.length).toBeLessThanOrEqual(1)
    // Race-safe bound (test/CLAUDE.md) — never assert exact equality against a
    // shared table other suites may also be writing to.
    expect(body.meta.totalItems).toBeGreaterThanOrEqual(body.data.length)
  })

  it('rejects an anonymous list request → 401', async () => {
    await request(app.getHttpServer())
      .get('/configurator-definitions')
      .expect(401)
  })

  // ── GET /configurator-definitions/:id ───────────────────────────────────

  it('gets a definition by id, including its (empty) options array → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/configurator-definitions/${selectDefId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const def = (res.body as ApiResponse<SegmentDefinition>).data
    expect(def.id).toBe(selectDefId)
    expect(def.options).toEqual([])
  })

  it('404s for a non-existent definition', async () => {
    await request(app.getHttpServer())
      .get('/configurator-definitions/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── PATCH /configurator-definitions/:id ─────────────────────────────────

  it("updates a definition's label/meaningTemplate → 200", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/configurator-definitions/${stringDefId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Updated label', meaningTemplate: 'Updated: {value}' })
      .expect(200)

    const def = (res.body as ApiResponse<SegmentDefinition>).data
    expect(def.label).toBe('Updated label')
    expect(def.meaningTemplate).toBe('Updated: {value}')
  })

  it('allows a dataType change when unassigned, re-validating constraints → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/configurator-definitions/${numberDefId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dataType: SegmentDataType.STRING,
        constraints: { minLength: 2, maxLength: 8 },
      })
      .expect(200)

    const def = (res.body as ApiResponse<SegmentDefinition>).data
    expect(def.dataType).toBe(SegmentDataType.STRING)
    expect(def.constraints).toEqual({ minLength: 2, maxLength: 8 })
  })

  it('rejects a dataType change with no matching constraints update → 400', async () => {
    // stringDefId is currently STRING; switching to NUMBER without NUMBER-shaped
    // constraints must fail the re-validation.
    await request(app.getHttpServer())
      .patch(`/configurator-definitions/${stringDefId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dataType: SegmentDataType.NUMBER })
      .expect(400)
  })

  it('rejects renaming a definition to a name already in use → 409', async () => {
    await request(app.getHttpServer())
      .patch(`/configurator-definitions/${stringDefId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Configurator Def - Select' })
      .expect(409)
  })

  it('rejects a non-admin update → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/configurator-definitions/${stringDefId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ label: 'should fail' })
      .expect(403)
  })

  describe('dataType immutability once assigned', () => {
    beforeAll(async () => {
      const def = await segmentDefinitionRepo.save(
        segmentDefinitionRepo.create({
          name: 'E2E Configurator Def - DataType Guard',
          label: 'Guarded field',
          dataType: SegmentDataType.STRING,
          constraints: { minLength: 1, maxLength: 5 },
          meaningTemplate: '{value}',
        }),
      )
      dataTypeGuardDefId = def.id

      await assignmentRepo.save(
        assignmentRepo.create({
          productId: assignedProductId,
          definitionId: dataTypeGuardDefId,
          position: 1,
        }),
      )
    })

    it('rejects a dataType change once a product assignment exists → 409', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-definitions/${dataTypeGuardDefId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dataType: SegmentDataType.NUMBER })
        .expect(409)
    })

    it('still allows non-dataType edits on an assigned definition → 200', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-definitions/${dataTypeGuardDefId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'Still editable' })
        .expect(200)
    })

    // ── DELETE while assigned ─────────────────────────────────────────────

    it('rejects deleting a definition that a product assignment references → 409, names the product', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/configurator-definitions/${dataTypeGuardDefId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409)

      const message = JSON.stringify(res.body)
      expect(message).toContain('E2E Configurator Assigned Product')
    })
  })

  // ── DELETE /configurator-definitions/:id (unassigned) ───────────────────

  it('deletes an unassigned definition → 200, gone from DB', async () => {
    const createRes = await createDefinition({
      name: 'E2E Configurator Def - Delete Me',
      label: 'Ephemeral',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1, maxLength: 5 },
      meaningTemplate: '{value}',
    }).expect(201)
    const id: number = (createRes.body as ApiResponse<SegmentDefinition>).data
      .id

    const deleteRes = await request(app.getHttpServer())
      .delete(`/configurator-definitions/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (deleteRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id })

    const found: SegmentDefinition | null =
      await segmentDefinitionRepo.findOneBy({ id })
    expect(found).toBeNull()
  })

  it('rejects a non-admin delete → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/configurator-definitions/${selectDefId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  // ── POST /configurator-definitions/:id/options ──────────────────────────

  it('adds an option to a SELECT definition → 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/configurator-definitions/${selectDefId}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '1m', label: 'single Pt100', sortOrder: 0 })
      .expect(201)

    const option = (res.body as ApiResponse<SegmentOption>).data
    expect(option.definitionId).toBe(selectDefId)
    expect(option.value).toBe('1m')
  })

  it('rejects the reserved value "0" → 400', async () => {
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${selectDefId}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '0', label: 'zero' })
      .expect(400)
  })

  it('rejects adding an option to a non-SELECT definition → 400', async () => {
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${stringDefId}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'x', label: 'x' })
      .expect(400)
  })

  it('rejects a duplicate value on the same definition → 409', async () => {
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${selectDefId}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '1m', label: 'duplicate' })
      .expect(409)
  })

  it('404s when the parent definition does not exist', async () => {
    await request(app.getHttpServer())
      .post('/configurator-definitions/999999/options')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'x', label: 'x' })
      .expect(404)
  })

  it('rejects an anonymous option create → 401', async () => {
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${selectDefId}/options`)
      .send({ value: '2m', label: 'double Pt100' })
      .expect(401)
  })

  it('rejects a non-admin option create → 403', async () => {
    await request(app.getHttpServer())
      .post(`/configurator-definitions/${selectDefId}/options`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ value: '2m', label: 'double Pt100' })
      .expect(403)
  })

  // ── PATCH /configurator-options/:optionId ───────────────────────────────

  describe('updating options', () => {
    let optionAId: number
    let optionBId: number

    beforeAll(async () => {
      const defRes = await createDefinition({
        name: 'E2E Configurator Def - Update Options',
        label: 'Update options target',
        dataType: SegmentDataType.SELECT,
        meaningTemplate: '{label}',
      }).expect(201)
      const defId = (defRes.body as ApiResponse<SegmentDefinition>).data.id

      const a = await request(app.getHttpServer())
        .post(`/configurator-definitions/${defId}/options`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'p1', label: 'Option P1' })
        .expect(201)
      optionAId = (a.body as ApiResponse<SegmentOption>).data.id

      const b = await request(app.getHttpServer())
        .post(`/configurator-definitions/${defId}/options`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'p2', label: 'Option P2' })
        .expect(201)
      optionBId = (b.body as ApiResponse<SegmentOption>).data.id
    })

    it('updates label/value → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/configurator-options/${optionAId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'Renamed P1' })
        .expect(200)

      expect((res.body as ApiResponse<SegmentOption>).data.label).toBe(
        'Renamed P1',
      )
    })

    it('rejects value "0" → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-options/${optionBId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '0' })
        .expect(400)
    })

    it('rejects a value collision with a sibling option → 409', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-options/${optionBId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'p1' })
        .expect(409)
    })

    it('404s for a non-existent option', async () => {
      await request(app.getHttpServer())
        .patch('/configurator-options/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'ghost' })
        .expect(404)
    })
  })

  // ── DELETE /configurator-options/:optionId ──────────────────────────────

  describe('deleting options', () => {
    it('deletes an option on an unassigned definition → 200, even down to 1 option', async () => {
      const defRes = await createDefinition({
        name: 'E2E Configurator Def - Option Guard Free',
        label: 'Free',
        dataType: SegmentDataType.SELECT,
        meaningTemplate: '{label}',
      }).expect(201)
      const defId = (defRes.body as ApiResponse<SegmentDefinition>).data.id

      const a = await request(app.getHttpServer())
        .post(`/configurator-definitions/${defId}/options`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'f1', label: 'Free 1' })
        .expect(201)
      const optionId = (a.body as ApiResponse<SegmentOption>).data.id

      await request(app.getHttpServer())
        .post(`/configurator-definitions/${defId}/options`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'f2', label: 'Free 2' })
        .expect(201)

      const deleteRes = await request(app.getHttpServer())
        .delete(`/configurator-options/${optionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(
        (deleteRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
      ).toEqual({ deleted: true, id: optionId })
    })

    it('404s for a non-existent option', async () => {
      await request(app.getHttpServer())
        .delete('/configurator-options/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    describe('when the parent definition is assigned', () => {
      let assignedDefId: number
      let optionToKeepId: number
      let optionToDeleteId: number

      beforeAll(async () => {
        const defRes = await createDefinition({
          name: 'E2E Configurator Def - Option Guard Assigned',
          label: 'Assigned',
          dataType: SegmentDataType.SELECT,
          meaningTemplate: '{label}',
        }).expect(201)
        assignedDefId = (defRes.body as ApiResponse<SegmentDefinition>).data.id

        const a = await request(app.getHttpServer())
          .post(`/configurator-definitions/${assignedDefId}/options`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ value: 'a1', label: 'Assigned 1' })
          .expect(201)
        optionToKeepId = (a.body as ApiResponse<SegmentOption>).data.id

        const b = await request(app.getHttpServer())
          .post(`/configurator-definitions/${assignedDefId}/options`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ value: 'a2', label: 'Assigned 2' })
          .expect(201)
        optionToDeleteId = (b.body as ApiResponse<SegmentOption>).data.id

        // Directly seed the assignment — position 2 keeps (productId, position)
        // unique alongside the dataType-guard fixture's position 1.
        await assignmentRepo.save(
          assignmentRepo.create({
            productId: assignedProductId,
            definitionId: assignedDefId,
            position: 2,
          }),
        )
      })

      it('rejects deleting an option that would drop an assigned SELECT below 2 options → 409', async () => {
        await request(app.getHttpServer())
          .delete(`/configurator-options/${optionToDeleteId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(409)
      })

      it('the option-to-keep is unaffected and still resolvable', async () => {
        const res = await request(app.getHttpServer())
          .get(`/configurator-definitions/${assignedDefId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        const def = (res.body as ApiResponse<SegmentDefinition>).data
        const optionIds = (def.options ?? []).map((o) => o.id)
        expect(optionIds).toContain(optionToKeepId)
        expect(optionIds).toContain(optionToDeleteId)
      })
    })

    it('rejects a non-admin delete → 403', async () => {
      const defRes = await createDefinition({
        name: 'E2E Configurator Def - Not Found 404',
        label: 'Role guard target',
        dataType: SegmentDataType.SELECT,
        meaningTemplate: '{label}',
      }).expect(201)
      const defId = (defRes.body as ApiResponse<SegmentDefinition>).data.id

      const a = await request(app.getHttpServer())
        .post(`/configurator-definitions/${defId}/options`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'g1', label: 'Guard 1' })
        .expect(201)
      const optionId = (a.body as ApiResponse<SegmentOption>).data.id

      await request(app.getHttpServer())
        .delete(`/configurator-options/${optionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })
  })
})
