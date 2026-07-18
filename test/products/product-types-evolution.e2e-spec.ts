import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Product } from '../../src/products/entities/product.entity'
import {
  FilterableField,
  ProductType,
} from '../../src/products/entities/product-type.entity'
import { UploadFile } from '../../src/uploads/entities/upload-file.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Exercises the field-evolution rules on PATCH /product-types/:id: fields are
// add/remove only, key and type are immutable, and a field or enum option can only
// be removed when no product still holds data for it.
describe('Product type evolution (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string

  let productRepo: Repository<Product>
  let productTypeRepo: Repository<ProductType>
  let uploadFileRepo: Repository<UploadFile>

  let typeId: number
  let productId: number

  const ADMIN_EMAIL = 'pt-evo-admin@e2e.test'
  const PASSWORD = 'Password1!'

  const TYPE_SLUG = 'e2e-evo-type'
  const PRODUCT_SLUG = 'e2e-evo-product'

  // The starting field schema: one string, one enum, one number.
  const initialFields: FilterableField[] = [
    { key: 'brand', label: 'Brand', type: 'string' },
    {
      key: 'head',
      label: 'Head',
      type: 'enum',
      options: ['withHead', 'noHead'],
    },
    { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
  ]

  // Sends a PATCH that replaces the whole filterableFields array.
  const patchFields = (fields: FilterableField[]) =>
    request(app.getHttpServer())
      .patch(`/product-types/${typeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ filterableFields: fields })

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    productRepo = dataSource.getRepository(Product)
    productTypeRepo = dataSource.getRepository(ProductType)
    uploadFileRepo = dataSource.getRepository(UploadFile)

    // Pre-cleanup: remove rows left by a previous failed run (FK order — product's
    // upload_file rows, then the product, then the type).
    const existingProduct = await productRepo.findOne({
      where: { slug: PRODUCT_SLUG },
      withDeleted: true,
    })
    if (existingProduct) {
      await uploadFileRepo.delete({ productId: existingProduct.id })
      await productRepo.delete({ id: existingProduct.id })
    }
    await productTypeRepo.delete({ slug: TYPE_SLUG })
    await cleanupUsers(dataSource, [ADMIN_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'PtEvoAdmin',
      role: UserRole.ADMIN,
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)

    // Seed the type under test.
    const ptRes = await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'e2e-evo-type',
        slug: TYPE_SLUG,
        filterableFields: initialFields,
      })
      .expect(201)
    typeId = (ptRes.body as ApiResponse<ProductType>).data.id

    // Seed one published product that populates every field.
    const pRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Evolution Product',
        slug: PRODUCT_SLUG,
        productTypeId: typeId,
        shortDescription: 'Product used by the type-evolution tests',
        specs: { brand: 'Omega', head: 'withHead', temp: 1260 },
        isPublished: true,
      })
      .expect(201)
    productId = (pRes.body as ApiResponse<Product>).data.id
  })

  afterAll(async () => {
    await uploadFileRepo.delete({ productId })
    await productRepo.delete({ id: productId })
    await productTypeRepo.delete({ id: typeId })
    await cleanupUsers(dataSource, [ADMIN_EMAIL])
    await app.close()
  })

  // Restores the type to its initial fields after each mutating test so tests do
  // not depend on one another's leftover schema. Uses the repo directly to bypass
  // the very guards under test.
  afterEach(async () => {
    await productTypeRepo.update(
      { id: typeId },
      { filterableFields: initialFields },
    )
  })

  // ── SAFE changes ──────────────────────────────────────────────────────────

  it('allows adding a new field → 200', async () => {
    await patchFields([
      ...initialFields,
      { key: 'sheath', label: 'Sheath', type: 'string' },
    ]).expect(200)
  })

  it('allows changing only a label/unit on a kept field → 200', async () => {
    const fields: FilterableField[] = [
      { key: 'brand', label: 'Brand', type: 'string' },
      {
        key: 'head',
        label: 'Head',
        type: 'enum',
        options: ['withHead', 'noHead'],
      },
      { key: 'temp', label: 'Max Temperature', type: 'number', unit: 'K' },
    ]
    await patchFields(fields).expect(200)
  })

  it('allows adding an enum option → 200', async () => {
    const fields: FilterableField[] = [
      { key: 'brand', label: 'Brand', type: 'string' },
      {
        key: 'head',
        label: 'Head',
        type: 'enum',
        options: ['withHead', 'noHead', 'partialHead'],
      },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]
    await patchFields(fields).expect(200)
  })

  it('allows reordering fields → 200', async () => {
    await patchFields([
      initialFields[2],
      initialFields[0],
      initialFields[1],
    ]).expect(200)
  })

  it('allows removing an enum option no product uses → 200', async () => {
    // The seeded product uses 'withHead', so 'noHead' is safe to drop.
    const fields: FilterableField[] = [
      { key: 'brand', label: 'Brand', type: 'string' },
      { key: 'head', label: 'Head', type: 'enum', options: ['withHead'] },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]
    await patchFields(fields).expect(200)
  })

  it('allows removing a field that was never populated → 200', async () => {
    // Add an unused field, then remove it — no product ever set it.
    await patchFields([
      ...initialFields,
      { key: 'unused', label: 'Unused', type: 'string' },
    ]).expect(200)
    await patchFields(initialFields).expect(200)
  })

  it('allows toggling isFilterable on a kept field → 200', async () => {
    const fields: FilterableField[] = [
      { key: 'brand', label: 'Brand', type: 'string', isFilterable: false },
      {
        key: 'head',
        label: 'Head',
        type: 'enum',
        options: ['withHead', 'noHead'],
      },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]
    await patchFields(fields).expect(200)
  })

  it('rejects a GET /products filter on a field marked isFilterable: false → 400', async () => {
    // The seeded product holds brand: 'Omega' — still a valid stored spec,
    // just no longer offered as a filter facet once isFilterable is false.
    await patchFields([
      { key: 'brand', label: 'Brand', type: 'string', isFilterable: false },
      {
        key: 'head',
        label: 'Head',
        type: 'enum',
        options: ['withHead', 'noHead'],
      },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]).expect(200)

    await request(app.getHttpServer())
      .get(`/products?typeSlug=${TYPE_SLUG}&specs[brand]=Omega`)
      .expect(400)
  })

  // ── BLOCKED changes ───────────────────────────────────────────────────────

  it("rejects changing a field's type → 400", async () => {
    const fields: FilterableField[] = [
      { key: 'brand', label: 'Brand', type: 'number' },
      {
        key: 'head',
        label: 'Head',
        type: 'enum',
        options: ['withHead', 'noHead'],
      },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]
    await patchFields(fields).expect(400)
  })

  it('rejects removing a field a product still uses → 409', async () => {
    // Drop 'brand', which the seeded product populates with 'Omega'.
    const fields: FilterableField[] = [
      {
        key: 'head',
        label: 'Head',
        type: 'enum',
        options: ['withHead', 'noHead'],
      },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]
    await patchFields(fields).expect(409)
  })

  it('rejects removing an enum option a product still uses → 409', async () => {
    // Drop 'withHead', which the seeded product uses.
    const fields: FilterableField[] = [
      { key: 'brand', label: 'Brand', type: 'string' },
      { key: 'head', label: 'Head', type: 'enum', options: ['noHead'] },
      { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    ]
    await patchFields(fields).expect(409)
  })
})
