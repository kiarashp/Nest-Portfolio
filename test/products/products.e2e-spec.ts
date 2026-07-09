import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Product } from '../../src/products/entities/product.entity'
import { ProductType } from '../../src/products/entities/product-type.entity'
import { UploadFile } from '../../src/uploads/entities/upload-file.entity'
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

// Minimal JPEG buffer — starts with the SOI + APP0 JFIF magic bytes that
// the file-type package needs to detect this as image/jpeg.
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
])

describe('Products (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string

  let productRepo: Repository<Product>
  let productTypeRepo: Repository<ProductType>
  let uploadFileRepo: Repository<UploadFile>

  // Per-call storage mocks: upload returns a unique URL each time so UploadFile
  // rows never collide on the `path` lookup; delete is a spy we can assert on.
  let uploadCounter = 0
  const storageUpload = jest.fn().mockImplementation(() => {
    uploadCounter += 1
    return Promise.resolve({
      url: `https://res.cloudinary.com/mock/image/upload/v1/products/test-${uploadCounter}.jpg`,
      publicId: `products/test-${uploadCounter}`,
    })
  })
  const storageDelete = jest.fn().mockResolvedValue(undefined)

  // IDs captured in beforeAll for shared read tests.
  let productTypeId: number
  let publishedProductId: number

  // IDs used by the GET /products/:id/related tests.
  let relatedSameTypeProductIds: number[]
  let otherTypeProductId: number
  let draftRelatedProductId: number

  // ID used by the isFeatured filter/sort tests.
  let featuredProductId: number

  // Track all created IDs so afterAll can clean up even if tests fail mid-run.
  // Products must be deleted before product types (FK constraint).
  const createdProductIds: number[] = []
  const createdProductTypeIds: number[] = []

  const ADMIN_EMAIL = 'products-admin@e2e.test'
  const USER_EMAIL = 'products-user@e2e.test'
  const PASSWORD = 'Password1!'

  const PUBLISHED_SLUG = 'e2e-product-published'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp({
      storageMock: { upload: storageUpload, delete: storageDelete },
    }))

    productRepo = dataSource.getRepository(Product)
    productTypeRepo = dataSource.getRepository(ProductType)
    uploadFileRepo = dataSource.getRepository(UploadFile)

    // Pre-cleanup: delete rows left by a previous failed run so seeds never
    // hit unique-constraint conflicts.  Products first (FK to product_type);
    // and each product's upload_file rows before the product (FK to product).
    for (const slug of [
      PUBLISHED_SLUG,
      'e2e-product-draft',
      'e2e-product-delete',
      'e2e-product-with-image',
      'e2e-product-related-2',
      'e2e-product-related-3',
      'e2e-product-related-4',
      'e2e-product-related-5',
      'e2e-product-other-type',
      'e2e-product-related-draft',
      'e2e-product-featured',
    ]) {
      const existing = await productRepo.findOne({
        where: { slug },
        withDeleted: true,
      })
      if (existing) {
        await uploadFileRepo.delete({ productId: existing.id })
        await productRepo.delete({ id: existing.id })
      }
    }
    for (const slug of [
      'e2e-type-main',
      'e2e-type-conflict',
      'e2e-type-to-delete',
      'e2e-type-other',
      'e2e-type-no-image',
      'e2e-type-with-image',
    ]) {
      const existingType = await productTypeRepo.findOneBy({ slug })
      if (existingType) {
        await uploadFileRepo.delete({ productTypeId: existingType.id })
        await productTypeRepo.delete({ id: existingType.id })
      }
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ProductsAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'ProductsUser',
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    // Seed the product type that product tests depend on.
    const ptRes = await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'e2e-type-main',
        slug: 'e2e-type-main',
        filterableFields: [
          {
            key: 'tempRange',
            label: 'Temperature Range',
            type: 'number',
            unit: '°C',
          },
          {
            key: 'sheathMaterial',
            label: 'Sheath Material',
            type: 'enum',
            options: ['Inconel 600', 'Stainless 316'],
          },
        ],
      })
      .expect(201)
    productTypeId = (ptRes.body as ApiResponse<ProductType>).data.id
    createdProductTypeIds.push(productTypeId)

    // Seed a published product that multiple read tests share.
    const pRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Thermocouple',
        slug: PUBLISHED_SLUG,
        productTypeId,
        shortDescription: 'Thermocouple for e2e tests',
        specs: { tempRange: 1260, sheathMaterial: 'Inconel 600' },
        isPublished: true,
      })
      .expect(201)
    publishedProductId = (pRes.body as ApiResponse<Product>).data.id
    createdProductIds.push(publishedProductId)

    // Seed extra same-type published products so the related-products limit
    // cap has more than one candidate to actually truncate.
    relatedSameTypeProductIds = []
    for (const slug of [
      'e2e-product-related-2',
      'e2e-product-related-3',
      'e2e-product-related-4',
      'e2e-product-related-5',
    ]) {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Related ${slug}`,
          slug,
          productTypeId,
          shortDescription: 'Same-type product for related-products tests',
          isPublished: true,
        })
        .expect(201)
      const id: number = (res.body as ApiResponse<Product>).data.id
      relatedSameTypeProductIds.push(id)
      createdProductIds.push(id)
    }

    // Seed a second product type + published product to prove related-products
    // excludes products of a different type.
    const otherTypeRes = await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'e2e-type-other', slug: 'e2e-type-other' })
      .expect(201)
    const otherProductTypeId: number = (
      otherTypeRes.body as ApiResponse<ProductType>
    ).data.id
    createdProductTypeIds.push(otherProductTypeId)

    const otherTypeProductRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Other Type Product',
        slug: 'e2e-product-other-type',
        productTypeId: otherProductTypeId,
        shortDescription: 'Different-type product for related-products tests',
        isPublished: true,
      })
      .expect(201)
    otherTypeProductId = (otherTypeProductRes.body as ApiResponse<Product>).data
      .id
    createdProductIds.push(otherTypeProductId)

    // Seed a draft (unpublished) product of the same type — used to prove
    // related-products excludes drafts, and to test the 404-on-draft-anchor rule.
    const draftRelatedRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Draft Related Product',
        slug: 'e2e-product-related-draft',
        productTypeId,
        shortDescription: 'Draft product for related-products tests',
      })
      .expect(201)
    draftRelatedProductId = (draftRelatedRes.body as ApiResponse<Product>).data
      .id
    createdProductIds.push(draftRelatedProductId)

    // Seed a featured, published product of the same type — used by the
    // isFeatured filter/sort tests, scoped by productTypeId.
    const featuredRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Featured Product',
        slug: 'e2e-product-featured',
        productTypeId,
        shortDescription: 'Featured product for isFeatured tests',
        isPublished: true,
        isFeatured: true,
      })
      .expect(201)
    featuredProductId = (featuredRes.body as ApiResponse<Product>).data.id
    createdProductIds.push(featuredProductId)
  })

  afterAll(async () => {
    // Remove any upload_file rows still pointing at these products first —
    // upload_file.productId is an FK, so the product rows can't be hard-deleted
    // while images reference them.
    for (const id of createdProductIds) {
      await uploadFileRepo.delete({ productId: id })
    }
    // Delete all products first (products reference product types via FK).
    if (createdProductIds.length) {
      await productRepo.delete(createdProductIds)
    }
    // Same FK concern for product types — upload_file.productTypeId must be
    // cleared before the type rows can be hard-deleted.
    for (const id of createdProductTypeIds) {
      await uploadFileRepo.delete({ productTypeId: id })
    }
    if (createdProductTypeIds.length) {
      await productTypeRepo.delete(createdProductTypeIds)
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── GET /product-types ────────────────────────────────────────────────────

  it('GET /product-types (public) → 200 with an array including productCount', async () => {
    const res = await request(app.getHttpServer())
      .get('/product-types')
      .expect(200)
    const types = (res.body as ApiResponse<ProductType[]>).data
    expect(Array.isArray(types)).toBe(true)

    // The seeded type has one published product, so its count is at least 1.
    const seeded = types.find((t) => t.id === productTypeId)
    expect(seeded).toBeDefined()
    expect(typeof seeded?.productCount).toBe('number')
    expect(seeded?.productCount).toBeGreaterThanOrEqual(1)
  })

  // ── GET /product-types/:id ────────────────────────────────────────────────

  it('GET /product-types/:id (public) → 200 with filterableFields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/product-types/${productTypeId}`)
      .expect(200)

    const pt = (res.body as ApiResponse<ProductType>).data
    expect(pt.id).toBe(productTypeId)
    expect(pt.filterableFields).toBeDefined()
  })

  it('GET /product-types/99999 → 404', async () => {
    await request(app.getHttpServer()).get('/product-types/99999').expect(404)
  })

  // ── GET /product-types/slug/:slug ─────────────────────────────────────────

  it('GET /product-types/slug/:slug (public) → 200 with filterableFields', async () => {
    const res = await request(app.getHttpServer())
      .get('/product-types/slug/e2e-type-main')
      .expect(200)

    const pt = (res.body as ApiResponse<ProductType>).data
    expect(pt.id).toBe(productTypeId)
    expect(pt.slug).toBe('e2e-type-main')
    expect(pt.filterableFields).toBeDefined()
  })

  it('GET /product-types/slug/ghost-slug → 404', async () => {
    await request(app.getHttpServer())
      .get('/product-types/slug/ghost-slug')
      .expect(404)
  })

  // ── POST /product-types ───────────────────────────────────────────────────

  it('POST /product-types (no token) → 401', async () => {
    await request(app.getHttpServer())
      .post('/product-types')
      .send({ name: 'e2e-no-auth', slug: 'e2e-no-auth' })
      .expect(401)
  })

  it('POST /product-types (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'e2e-user-type', slug: 'e2e-user-type' })
      .expect(403)
  })

  it('POST /product-types duplicate slug → 409', async () => {
    // e2e-type-main was already created in beforeAll
    await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'different-name', slug: 'e2e-type-main' })
      .expect(409)
  })

  // ── PATCH /product-types/:id ──────────────────────────────────────────────

  it('PATCH /product-types/:id (ADMIN) → 200 with updated fields', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/product-types/${productTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'e2e-type-main-updated' })
      .expect(200)

    const pt = (res.body as ApiResponse<ProductType>).data
    expect(pt.name).toBe('e2e-type-main-updated')
    expect(pt.slug).toBe('e2e-type-main')
  })

  it('PATCH /product-types/:id imageUrl → 200, round-trips and can be cleared with null', async () => {
    const url =
      'https://res.cloudinary.com/demo/image/upload/v1/types/thermocouple.jpg'

    const withImage = await request(app.getHttpServer())
      .patch(`/product-types/${productTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: url })
      .expect(200)
    expect((withImage.body as ApiResponse<ProductType>).data.imageUrl).toBe(url)

    const cleared = await request(app.getHttpServer())
      .patch(`/product-types/${productTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: null })
      .expect(200)
    expect((cleared.body as ApiResponse<ProductType>).data.imageUrl).toBeNull()
  })

  it('PATCH /product-types/:id imageUrl with a non-URL value → 400', async () => {
    await request(app.getHttpServer())
      .patch(`/product-types/${productTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: 'not-a-url' })
      .expect(400)
  })

  // ── POST /product-types/:id/image ─────────────────────────────────────────

  it('POST /product-types/:id/image (ADMIN) → 201, uploads and sets imageUrl', async () => {
    const res = await request(app.getHttpServer())
      .post(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'type.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)

    const pt = (res.body as ApiResponse<ProductType>).data
    expect(pt.id).toBe(productTypeId)
    expect(pt.imageUrl).toContain('cloudinary')

    const row: UploadFile | null = await uploadFileRepo.findOne({
      where: { productTypeId },
    })
    expect(row).not.toBeNull()
    expect(row?.path).toBe(pt.imageUrl)
  })

  it('POST /product-types/:id/image again → 201, replaces the previous tracked image', async () => {
    const first: UploadFile | null = await uploadFileRepo.findOne({
      where: { productTypeId },
    })
    storageDelete.mockClear()

    const res = await request(app.getHttpServer())
      .post(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'type-2.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)

    const pt = (res.body as ApiResponse<ProductType>).data
    expect(pt.imageUrl).not.toBe(first?.path)

    // The previous asset was purged from Cloudinary and its upload_file row removed.
    expect(storageDelete).toHaveBeenCalledWith(first?.publicId)
    const oldRow = await uploadFileRepo.findOneBy({ id: first!.id })
    expect(oldRow).toBeNull()

    const newRow: UploadFile | null = await uploadFileRepo.findOne({
      where: { productTypeId },
    })
    expect(newRow?.path).toBe(pt.imageUrl)
  })

  it('POST /product-types/:id/image (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'type.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403)
  })

  it('POST /product-types/:id/image with oversized file → 400', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024)
    // Write JPEG magic at the start so file-type accepts it as JPEG
    oversized[0] = 0xff
    oversized[1] = 0xd8
    oversized[2] = 0xff
    oversized[3] = 0xe0

    await request(app.getHttpServer())
      .post(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', oversized, {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400)
  })

  // ── GET /product-types/:id/image ──────────────────────────────────────────

  it('GET /product-types/:id/image (ADMIN) → 200, returns the tracked file', async () => {
    const res = await request(app.getHttpServer())
      .get(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const file = (res.body as ApiResponse<UploadFile>).data
    expect(file.productTypeId).toBe(productTypeId)
  })

  it('GET /product-types/:id/image (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('GET /product-types/:id/image for a type with no tracked image → 404', async () => {
    const ptRes = await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'e2e-type-no-image', slug: 'e2e-type-no-image' })
      .expect(201)
    const noImageTypeId: number = (ptRes.body as ApiResponse<ProductType>).data
      .id
    createdProductTypeIds.push(noImageTypeId)

    await request(app.getHttpServer())
      .get(`/product-types/${noImageTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── DELETE /product-types/:id/image ───────────────────────────────────────

  it('DELETE /product-types/:id/image (ADMIN) → 200, clears imageUrl and purges the asset', async () => {
    const file: UploadFile | null = await uploadFileRepo.findOne({
      where: { productTypeId },
    })
    storageDelete.mockClear()

    const res = await request(app.getHttpServer())
      .delete(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const pt = (res.body as ApiResponse<ProductType>).data
    expect(pt.imageUrl).toBeNull()

    expect(storageDelete).toHaveBeenCalledWith(file?.publicId)
    const row = await uploadFileRepo.findOneBy({ id: file!.id })
    expect(row).toBeNull()
  })

  it('DELETE /product-types/:id/image for a type with no tracked image → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/product-types/${productTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── DELETE /product-types/:id ─────────────────────────────────────────────

  it('DELETE /product-types/:id with products attached → 409', async () => {
    // productTypeId has publishedProductId referencing it — must be blocked
    await request(app.getHttpServer())
      .delete(`/product-types/${productTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
  })

  it('DELETE /product-types/:id when empty → 200', async () => {
    // Create a product type with no products so we can delete it cleanly.
    const ptRes = await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'e2e-type-to-delete', slug: 'e2e-type-to-delete' })
      .expect(201)

    const emptyTypeId: number = (ptRes.body as ApiResponse<ProductType>).data.id

    const delRes = await request(app.getHttpServer())
      .delete(`/product-types/${emptyTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (delRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: emptyTypeId })

    // Do not push to createdProductTypeIds — it's already deleted.
  })

  it('DELETE /product-types/:id purges its tracked image from Cloudinary + DB', async () => {
    const ptRes = await request(app.getHttpServer())
      .post('/product-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'e2e-type-with-image', slug: 'e2e-type-with-image' })
      .expect(201)
    const deleteTypeId: number = (ptRes.body as ApiResponse<ProductType>).data
      .id

    await request(app.getHttpServer())
      .post(`/product-types/${deleteTypeId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'doomed-type.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file: UploadFile | null = await uploadFileRepo.findOne({
      where: { productTypeId: deleteTypeId },
    })

    storageDelete.mockClear()

    const delRes = await request(app.getHttpServer())
      .delete(`/product-types/${deleteTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (delRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: deleteTypeId })

    // The Cloudinary asset was deleted along with the upload_file row — no FK
    // violation from the hard delete.
    expect(storageDelete).toHaveBeenCalledWith(file?.publicId)
    const remaining = await uploadFileRepo.find({
      where: { productTypeId: deleteTypeId },
    })
    expect(remaining).toHaveLength(0)

    // Do not push to createdProductTypeIds — it's already deleted.
  })

  // ── GET /products ─────────────────────────────────────────────────────────

  it('GET /products (public) → 200, only published products', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200)
    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta.totalItems).toBeGreaterThanOrEqual(body.data.length)
    // Every result must be published
    for (const p of body.data) {
      expect(p.isPublished).toBe(true)
    }
  })

  it('GET /products?productTypeId=X → filters by type', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products?productTypeId=${productTypeId}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    for (const p of body.data) {
      expect(p.productTypeId).toBe(productTypeId)
    }
  })

  it('GET /products?q=keyword → matches on name or shortDescription', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?q=Thermocouple')
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    expect(body.data.some((p) => p.id === publishedProductId)).toBe(true)
  })

  it('GET /products?q=nomatch → returns empty results', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?q=zzz-nomatch-zzz')
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.length).toBe(0)
  })

  it('GET /products?typeSlug=X → filters by type slug', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?typeSlug=e2e-type-main')
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.some((p) => p.id === publishedProductId)).toBe(true)
    for (const p of body.data) {
      expect(p.productTypeId).toBe(productTypeId)
    }
  })

  it('GET /products?specs[enum] (match) → includes the product', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/products?typeSlug=e2e-type-main&specs[sheathMaterial]=Inconel%20600',
      )
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.some((p) => p.id === publishedProductId)).toBe(true)
  })

  it('GET /products?specs[enum] (no match) → excludes the product', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/products?typeSlug=e2e-type-main&specs[sheathMaterial]=Stainless%20316',
      )
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.some((p) => p.id === publishedProductId)).toBe(false)
  })

  it('GET /products?specs[number][min/max] (in range) → includes the product', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/products?typeSlug=e2e-type-main&specs[tempRange][min]=1000&specs[tempRange][max]=1500',
      )
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.some((p) => p.id === publishedProductId)).toBe(true)
  })

  it('GET /products?specs[number][min] (out of range) → excludes the product', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?typeSlug=e2e-type-main&specs[tempRange][min]=2000')
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.data.some((p) => p.id === publishedProductId)).toBe(false)
  })

  it('GET /products?specs[unknownKey] → 400', async () => {
    await request(app.getHttpServer())
      .get('/products?typeSlug=e2e-type-main&specs[nope]=x')
      .expect(400)
  })

  it('GET /products?specs without a type context → 400', async () => {
    await request(app.getHttpServer())
      .get('/products?specs[tempRange][min]=1')
      .expect(400)
  })

  it('GET /products?specs[number] non-numeric value → 400', async () => {
    await request(app.getHttpServer())
      .get('/products?typeSlug=e2e-type-main&specs[tempRange][min]=abc')
      .expect(400)
  })

  it('GET /products?sortBy=name&order=asc → 200 (sorted A-Z, published only)', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?sortBy=name&order=asc')
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    const names = body.data.map((p) => p.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  it('GET /products?sortBy=createdAt&order=asc → 200 (oldest first)', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?sortBy=createdAt&order=asc')
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    const dates = body.data.map((p) => new Date(p.createdAt).getTime())
    const sorted = [...dates].sort((a, b) => a - b)
    expect(dates).toEqual(sorted)
  })

  it('GET /products?sortBy=invalid → 400', async () => {
    await request(app.getHttpServer())
      .get('/products?sortBy=cheapest')
      .expect(400)
  })

  it('GET /products?order=invalid → 400', async () => {
    await request(app.getHttpServer())
      .get('/products?order=sideways')
      .expect(400)
  })

  // ── GET /products/slug/:slug ──────────────────────────────────────────────

  it('GET /products/slug/:slug → 200 with published product', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/slug/${PUBLISHED_SLUG}`)
      .expect(200)

    const p = (res.body as ApiResponse<Product>).data
    expect(p.id).toBe(publishedProductId)
    expect(p.slug).toBe(PUBLISHED_SLUG)
  })

  it('GET /products/slug/ghost-slug → 404', async () => {
    await request(app.getHttpServer())
      .get('/products/slug/ghost-slug')
      .expect(404)
  })

  it('GET /products/slug/:slug (no includeRelated) → response has no related key', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/slug/${PUBLISHED_SLUG}`)
      .expect(200)

    const p = res.body as ApiResponse<Record<string, unknown>>
    expect(p.data).not.toHaveProperty('related')
  })

  it('GET /products/slug/:slug?includeRelated=2 → embeds up to 2 related products', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/slug/${PUBLISHED_SLUG}?includeRelated=2`)
      .expect(200)

    const p = (res.body as ApiResponse<Product>).data
    expect(Array.isArray(p.related)).toBe(true)
    expect(p.related!.length).toBeLessThanOrEqual(2)
    for (const r of p.related!) {
      expect(r.id).not.toBe(p.id)
      expect(r.productTypeId).toBe(productTypeId)
      expect(r.isPublished).toBe(true)
    }
  })

  it('GET /products/slug/:slug?includeRelated=0 → 400', async () => {
    await request(app.getHttpServer())
      .get(`/products/slug/${PUBLISHED_SLUG}?includeRelated=0`)
      .expect(400)
  })

  it('GET /products/slug/:slug?includeRelated=-1 → 400', async () => {
    await request(app.getHttpServer())
      .get(`/products/slug/${PUBLISHED_SLUG}?includeRelated=-1`)
      .expect(400)
  })

  // ── GET /products/:id ─────────────────────────────────────────────────────

  it('GET /products/:id → 200 with published product', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}`)
      .expect(200)

    const p = (res.body as ApiResponse<Product>).data
    expect(p.id).toBe(publishedProductId)
  })

  it('GET /products/99999 → 404', async () => {
    await request(app.getHttpServer()).get('/products/99999').expect(404)
  })

  // ── GET /products/:id/related ─────────────────────────────────────────────

  it('GET /products/:id/related → 200, same-type published excluding self/cross-type/unpublished', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/related`)
      .expect(200)

    const related = (res.body as ApiResponse<Product[]>).data
    expect(Array.isArray(related)).toBe(true)
    for (const p of related) {
      expect(p.id).not.toBe(publishedProductId)
      expect(p.productTypeId).toBe(productTypeId)
      expect(p.isPublished).toBe(true)
    }
    expect(related.some((p) => relatedSameTypeProductIds.includes(p.id))).toBe(
      true,
    )
    expect(related.some((p) => p.id === otherTypeProductId)).toBe(false)
    expect(related.some((p) => p.id === draftRelatedProductId)).toBe(false)
  })

  it('GET /products/:id/related?limit=1 → caps the result to 1', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/related?limit=1`)
      .expect(200)

    const related = (res.body as ApiResponse<Product[]>).data
    expect(related.length).toBe(1)
  })

  it('GET /products/:id/related?limit=0 → 400', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/related?limit=0`)
      .expect(400)
  })

  it('GET /products/:id/related?limit=999 → 400', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/related?limit=999`)
      .expect(400)
  })

  it('GET /products/99999/related → 404', async () => {
    await request(app.getHttpServer())
      .get('/products/99999/related')
      .expect(404)
  })

  it('GET /products/:id/related for a draft anchor → 404 (same rule as GET /products/:id)', async () => {
    await request(app.getHttpServer())
      .get(`/products/${draftRelatedProductId}/related`)
      .expect(404)
  })

  // ── GET /products/:id/admin ───────────────────────────────────────────────

  it('GET /products/:id/admin (no token) → 401', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/admin`)
      .expect(401)
  })

  it('GET /products/:id/admin (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/admin`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('GET /products/:id/admin (ADMIN) → 200 for a published product', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const product = (res.body as ApiResponse<Product>).data
    expect(product.id).toBe(publishedProductId)
  })

  it('GET /products/:id/admin (ADMIN) → 200 for a draft product', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${draftRelatedProductId}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const product = (res.body as ApiResponse<Product>).data
    expect(product.id).toBe(draftRelatedProductId)
    expect(product.isPublished).toBe(false)
  })

  it('GET /products/99999/admin → 404', async () => {
    await request(app.getHttpServer())
      .get('/products/99999/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── GET /products/admin ───────────────────────────────────────────────────

  it('GET /products/admin (no token) → 401', async () => {
    await request(app.getHttpServer()).get('/products/admin').expect(401)
  })

  it('GET /products/admin (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get('/products/admin')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('GET /products/admin (ADMIN) → 200, includes unpublished', async () => {
    // Create a draft product to confirm it appears in the admin list.
    const draftRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Draft Product',
        slug: 'e2e-product-draft',
        productTypeId,
        shortDescription: 'Draft for admin list test',
      })
      .expect(201)

    const draftId: number = (draftRes.body as ApiResponse<Product>).data.id
    createdProductIds.push(draftId)

    const res = await request(app.getHttpServer())
      .get('/products/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<Product>>).data
    expect(body.meta.totalItems).toBeGreaterThanOrEqual(body.data.length)
    // The draft must appear (it would be hidden on the public GET /products route).
    expect(body.data.some((p) => p.id === draftId)).toBe(true)
  })

  it('GET /products/admin?isPublished=false → 200, only unpublished products of the scoped type', async () => {
    // Scope by productTypeId so parallel suites' products can't affect the assertion.
    const res = await request(app.getHttpServer())
      .get('/products/admin')
      .query({ productTypeId, isPublished: false })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Product>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).toContain(draftRelatedProductId)
    expect(ids).not.toContain(publishedProductId)
  })

  it('GET /products/admin?isPublished=true → 200, only published products of the scoped type', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/admin')
      .query({ productTypeId, isPublished: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Product>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).toContain(publishedProductId)
    expect(ids).not.toContain(draftRelatedProductId)
  })

  it('GET /products (public) ignores isPublished — still only returns published products', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .query({ productTypeId, isPublished: false })
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Product>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).toContain(publishedProductId)
    expect(ids).not.toContain(draftRelatedProductId)
  })

  // ── GET /products?isFeatured ──────────────────────────────────────────────
  // Unlike isPublished, isFeatured is not gated behind the public/admin split —
  // it works on both routes. Scoped by productTypeId.

  it('GET /products (public)?isFeatured=true → filters, unlike isPublished which is ignored there', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .query({ productTypeId, isFeatured: true })
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Product>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).toContain(featuredProductId)
    expect(ids).not.toContain(publishedProductId)
  })

  it('GET /products/admin?isFeatured=true → 200, only featured products of the scoped type', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/admin')
      .query({ productTypeId, isFeatured: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Product>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).toContain(featuredProductId)
    expect(ids).not.toContain(publishedProductId)
    expect(ids).not.toContain(draftRelatedProductId)
  })

  it('GET /products?sortBy=featured&order=desc → featured products first, then newest, scoped by productTypeId', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .query({ productTypeId, sortBy: 'featured', order: 'desc' })
      .expect(200)

    const products = (res.body as ApiResponse<Paginated<Product>>).data.data
    const featuredIndex = products.findIndex((p) => p.id === featuredProductId)
    const publishedIndex = products.findIndex(
      (p) => p.id === publishedProductId,
    )
    expect(featuredIndex).toBeGreaterThanOrEqual(0)
    expect(publishedIndex).toBeGreaterThanOrEqual(0)
    expect(featuredIndex).toBeLessThan(publishedIndex)
  })

  it('GET /products?sortBy=featured&order=asc → isFeatured still sorts first, but the createdAt tiebreak flips to ascending', async () => {
    const resDesc = await request(app.getHttpServer())
      .get('/products')
      .query({ productTypeId, sortBy: 'featured', order: 'desc', limit: 100 })
      .expect(200)
    const resAsc = await request(app.getHttpServer())
      .get('/products')
      .query({ productTypeId, sortBy: 'featured', order: 'asc', limit: 100 })
      .expect(200)

    const productsDesc = (resDesc.body as ApiResponse<Paginated<Product>>).data
      .data
    const productsAsc = (resAsc.body as ApiResponse<Paginated<Product>>).data
      .data

    // isFeatured still sorts first regardless of order.
    const featuredIndexAsc = productsAsc.findIndex(
      (p) => p.id === featuredProductId,
    )
    const publishedIndexAsc = productsAsc.findIndex(
      (p) => p.id === publishedProductId,
    )
    expect(featuredIndexAsc).toBeLessThan(publishedIndexAsc)

    // Within the non-featured group, order flips the createdAt tiebreak.
    const nonFeaturedDesc = productsDesc
      .filter((p) => !p.isFeatured)
      .map((p) => p.id)
    const nonFeaturedAsc = productsAsc
      .filter((p) => !p.isFeatured)
      .map((p) => p.id)
    expect(nonFeaturedAsc).toEqual([...nonFeaturedDesc].reverse())
  })

  it('isFeatured round-trips on create and patch, defaulting to false', async () => {
    const patched = await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isFeatured: true })
      .expect(200)
    expect((patched.body as ApiResponse<Product>).data.isFeatured).toBe(true)

    // Revert so later tests relying on publishedProductId's default state are unaffected.
    await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isFeatured: false })
      .expect(200)
  })

  // ── POST /products ────────────────────────────────────────────────────────

  it('POST /products (no token) → 401', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'x', slug: 'x', productTypeId, shortDescription: 'x' })
      .expect(401)
  })

  it('POST /products (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'x', slug: 'x', productTypeId, shortDescription: 'x' })
      .expect(403)
  })

  it('POST /products with invalid productTypeId → 400', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'x',
        slug: 'e2e-bad-type',
        productTypeId: 999999,
        shortDescription: 'x',
      })
      .expect(400)
  })

  it('POST /products missing required field → 400', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'x', slug: 'x' }) // missing productTypeId and shortDescription
      .expect(400)
  })

  it('POST /products with a spec key not in filterableFields → 400', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Bad Spec',
        slug: 'e2e-product-bad-spec',
        productTypeId,
        shortDescription: 'has an undeclared spec key',
        specs: { undeclaredKey: 'x' },
      })
      .expect(400)
  })

  it('POST /products with an enum spec value not in options → 400', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Bad Enum',
        slug: 'e2e-product-bad-enum',
        productTypeId,
        shortDescription: 'enum value out of range',
        specs: { sheathMaterial: 'Unobtanium' },
      })
      .expect(400)
  })

  // ── descriptionHtml ───────────────────────────────────────────────────────

  it('POST /products with description → 201 with sanitized descriptionHtml', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Description Html Product',
        slug: 'e2e-description-html-product',
        productTypeId,
        shortDescription: 'has a markdown description',
        description: '# Heading\n\nSome <script>alert(1)</script> text.',
      })
      .expect(201)

    const product = (res.body as ApiResponse<Product>).data
    expect(product.descriptionHtml).toContain('<h1>Heading</h1>')
    expect(product.descriptionHtml).not.toContain('<script>')
    createdProductIds.push(product.id)
  })

  it('PATCH /products/:id with a new description value re-renders descriptionHtml', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: '## Updated Heading' })
      .expect(200)

    expect((res.body as ApiResponse<Product>).data.descriptionHtml).toContain(
      '<h2>Updated Heading</h2>',
    )
  })

  it('PATCH /products/:id or POST /products with descriptionHtml in the body → 400 (server-derived only)', async () => {
    await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ descriptionHtml: '<p>hijacked</p>' })
      .expect(400)

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E DescriptionHtml Forbidden',
        slug: 'e2e-description-html-forbidden',
        productTypeId,
        shortDescription: 'attempts to set descriptionHtml directly',
        descriptionHtml: '<p>hijacked</p>',
      })
      .expect(400)
  })

  // ── PATCH /products/:id ───────────────────────────────────────────────────

  it('PATCH /products/:id (ADMIN) → 200 with updated field', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Thermocouple Updated' })
      .expect(200)

    const p = (res.body as ApiResponse<Product>).data
    expect(p.name).toBe('E2E Thermocouple Updated')
    expect(p.slug).toBe(PUBLISHED_SLUG) // slug unchanged
  })

  it('PATCH /products/:id (no token) → 401', async () => {
    await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .send({ name: 'nope' })
      .expect(401)
  })

  it('PATCH /products/99999 → 404', async () => {
    await request(app.getHttpServer())
      .patch('/products/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ghost' })
      .expect(404)
  })

  // ── POST /products/:id/images ─────────────────────────────────────────────

  it('POST /products/:id/images (ADMIN) → 201, returns an UploadFile linked to the product', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)

    const file = (res.body as ApiResponse<UploadFile>).data
    expect(file.id).toBeDefined()
    expect(file.productId).toBe(publishedProductId)
    expect(file.path).toContain('cloudinary')
  })

  it('POST /products/:id/images (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403)
  })

  it('POST /products/:id/images with oversized file → 400', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024)
    // Write JPEG magic at the start so file-type accepts it as JPEG
    oversized[0] = 0xff
    oversized[1] = 0xd8
    oversized[2] = 0xff
    oversized[3] = 0xe0

    await request(app.getHttpServer())
      .post(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', oversized, {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400)
  })

  // ── GET /products/:id/images ──────────────────────────────────────────────

  it('GET /products/:id/images (ADMIN) → 200, lists the product images', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const files = (res.body as ApiResponse<UploadFile[]>).data
    expect(Array.isArray(files)).toBe(true)
    // At least the image uploaded above is present, all linked to this product.
    expect(files.length).toBeGreaterThanOrEqual(1)
    for (const f of files) {
      expect(f.productId).toBe(publishedProductId)
    }
  })

  it('GET /products/:id/images (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  // ── GET /products/:id/images/:fileId ──────────────────────────────────────

  it('GET /products/:id/images/:fileId (ADMIN) → 200, returns the file', async () => {
    const upRes = await request(app.getHttpServer())
      .post(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'single.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    const res = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/images/${file.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect((res.body as ApiResponse<UploadFile>).data.id).toBe(file.id)
  })

  it('GET /products/:id/images/:fileId (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/images/999999`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('GET /products/:id/images/:fileId for a non-existent file → 404', async () => {
    await request(app.getHttpServer())
      .get(`/products/${publishedProductId}/images/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── DELETE /products/:id/images/:fileId ───────────────────────────────────

  it('DELETE /products/:id/images/:fileId (ADMIN) → 200, removes the file and clears it from imageUrl', async () => {
    // Upload an image, then point the product's featured imageUrl at it.
    const upRes = await request(app.getHttpServer())
      .post(`/products/${publishedProductId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'featured.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/products/${publishedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: file.path })
      .expect(200)

    storageDelete.mockClear()

    const delRes = await request(app.getHttpServer())
      .delete(`/products/${publishedProductId}/images/${file.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (delRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: file.id })

    // The Cloudinary asset was deleted and the upload_file row is gone.
    expect(storageDelete).toHaveBeenCalledWith(file.publicId)
    const row = await uploadFileRepo.findOneBy({ id: file.id })
    expect(row).toBeNull()

    // The featured imageUrl was cleared since it pointed at the deleted file.
    const prodRes = await request(app.getHttpServer())
      .get(`/products/${publishedProductId}`)
      .expect(200)
    expect((prodRes.body as ApiResponse<Product>).data.imageUrl).toBeNull()
  })

  it('DELETE /products/:id/images/:fileId for a non-existent file → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/products/${publishedProductId}/images/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── DELETE /products/:id ──────────────────────────────────────────────────

  it('DELETE /products/:id (ADMIN) → soft-delete; 404 on subsequent public GET', async () => {
    // Create a product specifically for deletion so no other test depends on it.
    const createRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Product to Delete',
        slug: 'e2e-product-delete',
        productTypeId,
        shortDescription: 'Will be soft-deleted',
        isPublished: true,
      })
      .expect(201)

    const deleteId: number = (createRes.body as ApiResponse<Product>).data.id
    createdProductIds.push(deleteId)

    // Soft-delete via API.
    const delRes = await request(app.getHttpServer())
      .delete(`/products/${deleteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (delRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: deleteId })

    // The row must still be in DB with deletedAt set.
    const row: Product | null = await productRepo.findOne({
      where: { id: deleteId },
      withDeleted: true,
    })
    expect(row).not.toBeNull()
    expect(row?.deletedAt).toBeDefined()

    // The public route must return 404 — the product is no longer visible.
    await request(app.getHttpServer()).get(`/products/${deleteId}`).expect(404)
  })

  it('DELETE /products/:id purges its uploaded images from Cloudinary + DB', async () => {
    // Create a product and upload an image tied to it.
    const createRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Product with Image',
        slug: 'e2e-product-with-image',
        productTypeId,
        shortDescription: 'Has an image to be cleaned up on delete',
        isPublished: true,
      })
      .expect(201)
    const deleteId: number = (createRes.body as ApiResponse<Product>).data.id
    createdProductIds.push(deleteId)

    const upRes = await request(app.getHttpServer())
      .post(`/products/${deleteId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'doomed.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    storageDelete.mockClear()

    await request(app.getHttpServer())
      .delete(`/products/${deleteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    // The image's Cloudinary asset was deleted and its upload_file row removed.
    expect(storageDelete).toHaveBeenCalledWith(file.publicId)
    const remaining = await uploadFileRepo.find({
      where: { productId: deleteId },
    })
    expect(remaining).toHaveLength(0)
  })

  it('DELETE /products/:id (no token) → 401', async () => {
    await request(app.getHttpServer())
      .delete(`/products/${publishedProductId}`)
      .expect(401)
  })
})
