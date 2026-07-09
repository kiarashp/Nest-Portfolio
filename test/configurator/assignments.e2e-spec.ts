import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { SegmentDataType } from '../../src/configurator/enums/segment-data-type.enum'
import { SegmentDefinition } from '../../src/configurator/entities/segment-definition.entity'
import { ConfigurableProduct } from '../../src/configurator/entities/configurable-product.entity'
import { ProductSegmentAssignment } from '../../src/configurator/entities/product-segment-assignment.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Exercises the assignment surface (CONFIGURATOR.md §5.1/§7 Step 4): placing
// a SegmentDefinition at a position inside a ConfigurableProduct, gapless
// renumbering on insert/reorder/delete, and every condition validation rule
// from §4.2/§4.4. Fixtures are built through the real Step 2/3 HTTP APIs,
// now that both exist.
describe('Configurator assignments (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string

  let segmentDefinitionRepo: Repository<SegmentDefinition>
  let configurableProductRepo: Repository<ConfigurableProduct>

  const ADMIN_EMAIL = 'configurator-assignments-admin@e2e.test'
  const USER_EMAIL = 'configurator-assignments-user@e2e.test'
  const PASSWORD = 'Password1!'

  const PRODUCT_SLUGS = [
    'e2e-configurator-assignments-main',
    'e2e-configurator-assignments-patch',
    'e2e-configurator-assignments-delete',
  ]

  const DEFINITION_NAMES = [
    'E2E Assignment Def - Select YesNo',
    'E2E Assignment Def - Number Controller',
    'E2E Assignment Def - Number Target',
    'E2E Assignment Def - Number LowMin',
    'E2E Assignment Def - String',
    'E2E Assignment Def - Select TooFew',
    'E2E Assignment Def - Op Target 1',
    'E2E Assignment Def - Op Target 2',
    'E2E Assignment Def - Op Target 3',
    'E2E Assignment Def - Op Target 4',
    'E2E Assignment Def - Op Target 5',
  ]

  // Shared definition ids, built once in the top-level beforeAll and reused
  // across products — (productId, definitionId) uniqueness is per-product, so
  // the same definition can be assigned to several of this suite's products.
  let defSelectYesNo: number
  let defNumberController: number
  let defNumberTarget: number
  let defNumberLowMin: number
  let defString: number
  let defSelectTooFew: number
  let defOpTargets: number[]

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

  const patchAssignment = (
    assignmentId: number,
    body: Record<string, unknown>,
  ) =>
    request(app.getHttpServer())
      .patch(`/configurator-assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  const deleteAssignment = (assignmentId: number) =>
    request(app.getHttpServer())
      .delete(`/configurator-assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)

  const getProduct = (productId: number) =>
    request(app.getHttpServer())
      .get(`/configurator-products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    segmentDefinitionRepo = dataSource.getRepository(SegmentDefinition)
    configurableProductRepo = dataSource.getRepository(ConfigurableProduct)

    // Pre-cleanup: products first (cascades their assignments), then
    // definitions, so a previous failed run never leaves FK/unique conflicts.
    for (const slug of PRODUCT_SLUGS) {
      await configurableProductRepo.delete({ slug })
    }
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorAssignmentsAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorAssignmentsUser',
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    // Shared definition library for this suite.
    const selectYesNo = await createDefinition({
      name: 'E2E Assignment Def - Select YesNo',
      label: 'Has extension?',
      dataType: SegmentDataType.SELECT,
      meaningTemplate: 'Extension: {label}',
    }).expect(201)
    defSelectYesNo = (selectYesNo.body as ApiResponse<SegmentDefinition>).data
      .id
    await createOption(defSelectYesNo, { value: 'yes', label: 'Yes' }).expect(
      201,
    )
    await createOption(defSelectYesNo, { value: 'no', label: 'No' }).expect(201)

    const numberController = await createDefinition({
      name: 'E2E Assignment Def - Number Controller',
      label: 'Extension length (cm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 3, min: 1, max: 999 },
      meaningTemplate: 'Extension length: {value} cm',
    }).expect(201)
    defNumberController = (
      numberController.body as ApiResponse<SegmentDefinition>
    ).data.id

    const numberTarget = await createDefinition({
      name: 'E2E Assignment Def - Number Target',
      label: 'Extension diameter (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 2, min: 10, max: 99 },
      meaningTemplate: 'Extension diameter: {value} mm',
    }).expect(201)
    defNumberTarget = (numberTarget.body as ApiResponse<SegmentDefinition>).data
      .id

    const numberLowMin = await createDefinition({
      name: 'E2E Assignment Def - Number LowMin',
      label: 'Insertion length (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 4, min: 0, max: 2000 },
      meaningTemplate: 'Insertion length: {value} mm',
    }).expect(201)
    defNumberLowMin = (numberLowMin.body as ApiResponse<SegmentDefinition>).data
      .id

    const stringDef = await createDefinition({
      name: 'E2E Assignment Def - String',
      label: 'Serial suffix',
      dataType: SegmentDataType.STRING,
      constraints: { minLength: 1, maxLength: 5 },
      meaningTemplate: 'Suffix: {value}',
    }).expect(201)
    defString = (stringDef.body as ApiResponse<SegmentDefinition>).data.id

    const selectTooFew = await createDefinition({
      name: 'E2E Assignment Def - Select TooFew',
      label: 'Too few options',
      dataType: SegmentDataType.SELECT,
      meaningTemplate: '{label}',
    }).expect(201)
    defSelectTooFew = (selectTooFew.body as ApiResponse<SegmentDefinition>).data
      .id
    await createOption(defSelectTooFew, {
      value: 'only',
      label: 'Only',
    }).expect(201)

    defOpTargets = []
    for (let i = 1; i <= 5; i++) {
      const opTarget = await createDefinition({
        name: `E2E Assignment Def - Op Target ${i}`,
        label: `Op target ${i}`,
        dataType: SegmentDataType.STRING,
        constraints: { minLength: 1, maxLength: 5 },
        meaningTemplate: '{value}',
      }).expect(201)
      defOpTargets.push(
        (opTarget.body as ApiResponse<SegmentDefinition>).data.id,
      )
    }
  })

  afterAll(async () => {
    for (const slug of PRODUCT_SLUGS) {
      await configurableProductRepo.delete({ slug })
    }
    for (const name of DEFINITION_NAMES) {
      await segmentDefinitionRepo.delete({ name })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── POST /configurator-products/:id/assignments ─────────────────────────

  describe('POST /configurator-products/:id/assignments', () => {
    let productId: number
    let assignmentA: number // defSelectYesNo, position 1 initially
    let assignmentB: number // defNumberController
    let assignmentC: number // defNumberTarget, condition on A
    let assignmentD: number // defString, inserted at explicit position 1

    beforeAll(async () => {
      const res = await createProduct({
        name: 'E2E Assignment Product Main',
        slug: 'e2e-configurator-assignments-main',
        codePrefix: 'EAM',
      }).expect(201)
      productId = (res.body as ApiResponse<ConfigurableProduct>).data.id
    })

    it('appends an assignment with no position → 201, position 1', async () => {
      const res = await createAssignment(productId, {
        definitionId: defSelectYesNo,
      }).expect(201)
      const assignment = (res.body as ApiResponse<ProductSegmentAssignment>)
        .data
      expect(assignment.position).toBe(1)
      assignmentA = assignment.id
    })

    it('appends a second assignment with no position → 201, position 2', async () => {
      const res = await createAssignment(productId, {
        definitionId: defNumberController,
      }).expect(201)
      const assignment = (res.body as ApiResponse<ProductSegmentAssignment>)
        .data
      expect(assignment.position).toBe(2)
      assignmentB = assignment.id
    })

    it('appends a conditioned assignment (NUMBER target, valid min) → 201, position 3', async () => {
      const res = await createAssignment(productId, {
        definitionId: defNumberTarget,
        condition: {
          controllingAssignmentId: assignmentA,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
      }).expect(201)
      const assignment = (res.body as ApiResponse<ProductSegmentAssignment>)
        .data
      expect(assignment.position).toBe(3)
      expect(assignment.condition).toEqual({
        controllingAssignmentId: assignmentA,
        operator: 'eq',
        value: 'yes',
        effect: 'zero_fill',
      })
      assignmentC = assignment.id
    })

    it('GET the product returns ordered assignments with definitions and options', async () => {
      const res = await getProduct(productId).expect(200)
      const product = (res.body as ApiResponse<ConfigurableProduct>).data
      expect(product.assignments).toHaveLength(3)
      const positions = (product.assignments ?? []).map((a) => a.position)
      expect(positions).toEqual([1, 2, 3])
      const first = (product.assignments ?? [])[0]
      expect(first.definition.id).toBe(defSelectYesNo)
      expect(first.definition.options?.map((o) => o.value).sort()).toEqual([
        'no',
        'yes',
      ])
    })

    it('inserts at an explicit position, shifting existing siblings → 201', async () => {
      const res = await createAssignment(productId, {
        definitionId: defString,
        position: 1,
      }).expect(201)
      const assignment = (res.body as ApiResponse<ProductSegmentAssignment>)
        .data
      expect(assignment.position).toBe(1)
      assignmentD = assignment.id

      const productRes = await getProduct(productId).expect(200)
      const product = (productRes.body as ApiResponse<ConfigurableProduct>).data
      const byId = new Map(
        (product.assignments ?? []).map((a) => [a.id, a.position]),
      )
      expect(byId.get(assignmentD)).toBe(1)
      expect(byId.get(assignmentA)).toBe(2)
      expect(byId.get(assignmentB)).toBe(3)
      expect(byId.get(assignmentC)).toBe(4)
    })

    // ── condition shape errors (400) ──────────────────────────────────────

    it('rejects a comparison condition missing value → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[0],
        condition: {
          controllingAssignmentId: assignmentA,
          operator: 'eq',
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('rejects a between condition with min >= max → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[1],
        condition: {
          controllingAssignmentId: assignmentB,
          operator: 'between',
          min: 500,
          max: 100,
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('rejects a condition with an unknown key → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[2],
        condition: {
          controllingAssignmentId: assignmentA,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
          extra: 'nope',
        },
      }).expect(400)
    })

    // ── condition business-rule errors (400) ──────────────────────────────

    it('rejects a condition referencing an unknown controller → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[3],
        condition: {
          controllingAssignmentId: 999999,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('rejects a condition whose controller is not at a strictly lower position → 400', async () => {
      // appending would land after assignmentC (position 4); force position 1
      // so the referenced controller (assignmentC, position 4) is higher.
      await createAssignment(productId, {
        definitionId: defOpTargets[4],
        position: 1,
        condition: {
          controllingAssignmentId: assignmentC,
          operator: 'eq',
          value: '50',
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('rejects a STRING controller → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[0],
        condition: {
          controllingAssignmentId: assignmentD, // defString, position 1
          operator: 'eq',
          value: 'x',
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('rejects a disallowed operator for a SELECT controller → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[1],
        condition: {
          controllingAssignmentId: assignmentA, // SELECT
          operator: 'gt',
          value: 'yes',
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('rejects a NUMBER target with constraints.min < 1 when a condition is present → 400', async () => {
      await createAssignment(productId, {
        definitionId: defNumberLowMin,
        condition: {
          controllingAssignmentId: assignmentA,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
      }).expect(400)
    })

    it('allows the same NUMBER-min<1 definition without a condition → 201 (positive control)', async () => {
      await createAssignment(productId, {
        definitionId: defNumberLowMin,
      }).expect(201)
    })

    // ── SELECT readiness / position range ──────────────────────────────────

    it('rejects a SELECT definition with fewer than 2 options → 400', async () => {
      await createAssignment(productId, {
        definitionId: defSelectTooFew,
      }).expect(400)
    })

    it('rejects an out-of-range explicit position → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[2],
        position: 999,
      }).expect(400)
    })

    it('rejects position 0 → 400', async () => {
      await createAssignment(productId, {
        definitionId: defOpTargets[2],
        position: 0,
      }).expect(400)
    })

    // ── 404s ─────────────────────────────────────────────────────────────

    it('404s when the product does not exist', async () => {
      await createAssignment(999999, { definitionId: defOpTargets[2] }).expect(
        404,
      )
    })

    it('404s when the definition does not exist', async () => {
      await createAssignment(productId, { definitionId: 999999 }).expect(404)
    })

    // ── 409 duplicate ────────────────────────────────────────────────────

    it('rejects assigning the same definition twice to the same product → 409', async () => {
      await createAssignment(productId, {
        definitionId: defSelectYesNo,
      }).expect(409)
    })

    // ── auth ─────────────────────────────────────────────────────────────

    it('rejects an anonymous create → 401', async () => {
      await request(app.getHttpServer())
        .post(`/configurator-products/${productId}/assignments`)
        .send({ definitionId: defOpTargets[2] })
        .expect(401)
    })

    it('rejects a non-admin create → 403', async () => {
      await request(app.getHttpServer())
        .post(`/configurator-products/${productId}/assignments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ definitionId: defOpTargets[2] })
        .expect(403)
    })

    // ── positive control: every operator is valid for a NUMBER controller ──

    it('accepts eq/neq/gt/lt/between conditions against a NUMBER controller → 201 each', async () => {
      const operatorBodies: Record<string, unknown>[] = [
        { operator: 'eq', value: '100' },
        { operator: 'neq', value: '200' },
        { operator: 'gt', value: '50' },
        { operator: 'lt', value: '900' },
        { operator: 'between', min: 10, max: 500 },
      ]
      for (let i = 0; i < operatorBodies.length; i++) {
        await createAssignment(productId, {
          definitionId: defOpTargets[i],
          condition: {
            controllingAssignmentId: assignmentB, // NUMBER controller
            effect: 'zero_fill',
            ...operatorBodies[i],
          },
        }).expect(201)
      }
    })
  })

  // ── PATCH /configurator-assignments/:assignmentId ────────────────────────

  describe('PATCH /configurator-assignments/:assignmentId', () => {
    let productId: number
    let p1: number // defSelectYesNo, position 1
    let p2: number // defNumberTarget, condition on p1, position 2
    let p3: number // defString, position 3 (no relations)
    let p4: number // defNumberController, position 4
    let p5: number // defOpTargets[0], condition on p4, position 5

    beforeAll(async () => {
      const res = await createProduct({
        name: 'E2E Assignment Product Patch',
        slug: 'e2e-configurator-assignments-patch',
        codePrefix: 'EAP',
      }).expect(201)
      productId = (res.body as ApiResponse<ConfigurableProduct>).data.id

      const r1 = await createAssignment(productId, {
        definitionId: defSelectYesNo,
      }).expect(201)
      p1 = (r1.body as ApiResponse<ProductSegmentAssignment>).data.id

      const r2 = await createAssignment(productId, {
        definitionId: defNumberTarget,
        condition: {
          controllingAssignmentId: p1,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
      }).expect(201)
      p2 = (r2.body as ApiResponse<ProductSegmentAssignment>).data.id

      const r3 = await createAssignment(productId, {
        definitionId: defString,
      }).expect(201)
      p3 = (r3.body as ApiResponse<ProductSegmentAssignment>).data.id

      const r4 = await createAssignment(productId, {
        definitionId: defNumberController,
      }).expect(201)
      p4 = (r4.body as ApiResponse<ProductSegmentAssignment>).data.id

      const r5 = await createAssignment(productId, {
        definitionId: defOpTargets[0],
        condition: {
          controllingAssignmentId: p4,
          operator: 'lt',
          value: '500',
          effect: 'zero_fill',
        },
      }).expect(201)
      p5 = (r5.body as ApiResponse<ProductSegmentAssignment>).data.id
    })

    it('reorders an independent assignment (p3) to position 1 → 200, gapless renumber', async () => {
      const res = await patchAssignment(p3, { position: 1 }).expect(200)
      expect(
        (res.body as ApiResponse<ProductSegmentAssignment>).data.position,
      ).toBe(1)

      const productRes = await getProduct(productId).expect(200)
      const product = (productRes.body as ApiResponse<ConfigurableProduct>).data
      const byId = new Map(
        (product.assignments ?? []).map((a) => [a.id, a.position]),
      )
      expect(byId.get(p3)).toBe(1)
      expect(byId.get(p1)).toBe(2)
      expect(byId.get(p2)).toBe(3)
      expect(byId.get(p4)).toBe(4)
      expect(byId.get(p5)).toBe(5)
    })

    it('rejects moving a controller (p4) past its dependent (p5) → 409', async () => {
      await patchAssignment(p4, { position: 5 }).expect(409)
    })

    it("rejects moving a dependent (p2) to/before its own controller's (p1) position → 400", async () => {
      await patchAssignment(p2, { position: 1 }).expect(400)
    })

    it('rejects an out-of-range position → 400', async () => {
      await patchAssignment(p3, { position: 999 }).expect(400)
    })

    it('clears a condition by sending null → 200', async () => {
      const res = await patchAssignment(p5, { condition: null }).expect(200)
      expect(
        (res.body as ApiResponse<ProductSegmentAssignment>).data.condition,
      ).toBeNull()
    })

    it('404s when the assignment does not exist', async () => {
      await patchAssignment(999999, { position: 1 }).expect(404)
    })

    it('rejects an anonymous update → 401', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-assignments/${p3}`)
        .send({})
        .expect(401)
    })

    it('rejects a non-admin update → 403', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-assignments/${p3}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403)
    })
  })

  // ── DELETE /configurator-assignments/:assignmentId ───────────────────────

  describe('DELETE /configurator-assignments/:assignmentId', () => {
    let productId: number
    let q1: number // defSelectYesNo, position 1 — controller for q2
    let q2: number // defNumberTarget, condition on q1, position 2
    let q3: number // defString, position 3 — leaf

    beforeAll(async () => {
      const res = await createProduct({
        name: 'E2E Assignment Product Delete',
        slug: 'e2e-configurator-assignments-delete',
        codePrefix: 'EAD',
      }).expect(201)
      productId = (res.body as ApiResponse<ConfigurableProduct>).data.id

      const r1 = await createAssignment(productId, {
        definitionId: defSelectYesNo,
      }).expect(201)
      q1 = (r1.body as ApiResponse<ProductSegmentAssignment>).data.id

      const r2 = await createAssignment(productId, {
        definitionId: defNumberTarget,
        condition: {
          controllingAssignmentId: q1,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
      }).expect(201)
      q2 = (r2.body as ApiResponse<ProductSegmentAssignment>).data.id

      const r3 = await createAssignment(productId, {
        definitionId: defString,
      }).expect(201)
      q3 = (r3.body as ApiResponse<ProductSegmentAssignment>).data.id
    })

    it('rejects an anonymous delete → 401', async () => {
      await request(app.getHttpServer())
        .delete(`/configurator-assignments/${q1}`)
        .expect(401)
    })

    it('rejects a non-admin delete → 403', async () => {
      await request(app.getHttpServer())
        .delete(`/configurator-assignments/${q1}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })

    it('404s when the assignment does not exist', async () => {
      await deleteAssignment(999999).expect(404)
    })

    it('rejects deleting a controller with a dependent → 409, names the dependent position', async () => {
      const res = await deleteAssignment(q1).expect(409)
      expect(JSON.stringify(res.body)).toContain('2')
    })

    it('deletes a leaf assignment → 200, renumbers gaplessly', async () => {
      const res = await deleteAssignment(q3).expect(200)
      const body = (res.body as ApiResponse<{ deleted: boolean; id: number }>)
        .data
      expect(body).toEqual({ deleted: true, id: q3 })

      const productRes = await getProduct(productId).expect(200)
      const product = (productRes.body as ApiResponse<ConfigurableProduct>).data
      expect(product.assignments).toHaveLength(2)
      const byId = new Map(
        (product.assignments ?? []).map((a) => [a.id, a.position]),
      )
      expect(byId.get(q1)).toBe(1)
      expect(byId.get(q2)).toBe(2)
    })
  })
})
