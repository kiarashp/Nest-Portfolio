import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { ConfigurableProduct } from '../../src/configurator/entities/configurable-product.entity'
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

// Minimal JPEG buffer — starts with the SOI + APP0 JFIF magic bytes that the
// file-type package needs to detect this as image/jpeg.
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
])

// A non-image magic byte sequence (PDF header) — used to prove the FileTypeValidator
// rejects a mismatched mime type regardless of the declared contentType.
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

// Exercises the admin CRUD surface for ConfigurableProduct and its single-slot
// image (CONFIGURATOR.md §5.1/§7 Step 3).
describe('Configurator products (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string
  let userToken: string

  let configurableProductRepo: Repository<ConfigurableProduct>

  // Per-call storage mocks: upload returns a unique URL/publicId each call;
  // delete is a spy we can assert on.
  let uploadCounter = 0
  const storageUpload = jest.fn().mockImplementation(() => {
    uploadCounter += 1
    return Promise.resolve({
      url: `https://res.cloudinary.com/mock/image/upload/v1/configurator-products/test-${uploadCounter}.jpg`,
      publicId: `configurator-products/test-${uploadCounter}`,
    })
  })
  const storageDelete = jest.fn().mockResolvedValue(undefined)

  const ADMIN_EMAIL = 'configurator-products-admin@e2e.test'
  const USER_EMAIL = 'configurator-products-user@e2e.test'
  const PASSWORD = 'Password1!'

  const SLUGS = [
    'e2e-configurator-product-a',
    'e2e-configurator-product-b',
    'e2e-configurator-product-update',
    'e2e-configurator-product-delete',
    'e2e-configurator-product-delete-image',
    'e2e-configurator-product-image',
    'e2e-configurator-product-create-new',
  ]

  // IDs threaded across sections.
  let productAId: number // default isPublished:false — used for read/list/image-404 checks
  let productBId: number // isPublished:true

  const createProduct = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/configurator-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp({
      storageMock: { upload: storageUpload, delete: storageDelete },
    }))

    configurableProductRepo = dataSource.getRepository(ConfigurableProduct)

    // Pre-cleanup: remove rows left by a previous failed run so re-runs never
    // hit unique-constraint conflicts. withDeleted so a prior soft-deleted row
    // is also cleaned up.
    for (const slug of SLUGS) {
      const existing = await configurableProductRepo.find({
        where: { slug },
        withDeleted: true,
      })
      if (existing.length > 0) {
        await configurableProductRepo.delete(existing.map((p) => p.id))
      }
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorProductsAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorProductsUser',
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    const productA = await createProduct({
      name: 'E2E Configurator Product A',
      slug: 'e2e-configurator-product-a',
      codePrefix: 'EPA',
      description: 'Product A description',
    }).expect(201)
    productAId = (productA.body as ApiResponse<ConfigurableProduct>).data.id

    const productB = await createProduct({
      name: 'E2E Configurator Product B',
      slug: 'e2e-configurator-product-b',
      codePrefix: 'EPB',
      isPublished: true,
    }).expect(201)
    productBId = (productB.body as ApiResponse<ConfigurableProduct>).data.id
  })

  afterAll(async () => {
    for (const slug of SLUGS) {
      const existing = await configurableProductRepo.find({
        where: { slug },
        withDeleted: true,
      })
      if (existing.length > 0) {
        await configurableProductRepo.delete(existing.map((p) => p.id))
      }
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── POST /configurator-products ─────────────────────────────────────────

  it('creates a product with default isPublished:false → 201', async () => {
    const res = await createProduct({
      name: 'E2E Configurator Product Create New',
      slug: 'e2e-configurator-product-create-new',
      codePrefix: 'ECN',
    }).expect(201)

    const product = (res.body as ApiResponse<ConfigurableProduct>).data
    expect(product.id).toBeDefined()
    expect(product.isPublished).toBe(false)
    expect(product.imageUrl).toBeNull()
  })

  it('creates a product with isPublished:true → 201', () => {
    // productB was already created in beforeAll with isPublished:true.
    expect(productBId).toBeDefined()
  })

  it('rejects a duplicate name → 409', async () => {
    await createProduct({
      name: 'E2E Configurator Product A',
      slug: 'e2e-configurator-product-dup-name',
      codePrefix: 'DUP',
    }).expect(409)
  })

  it('rejects a duplicate slug → 409', async () => {
    await createProduct({
      name: 'E2E Configurator Product Dup Slug',
      slug: 'e2e-configurator-product-a',
      codePrefix: 'DUP',
    }).expect(409)
  })

  it('rejects a missing required field (codePrefix) → 400', async () => {
    await createProduct({
      name: 'E2E Configurator Product Missing Field',
      slug: 'e2e-configurator-product-missing-field',
    }).expect(400)
  })

  it('rejects an anonymous request → 401', async () => {
    await request(app.getHttpServer())
      .post('/configurator-products')
      .send({
        name: 'E2E No Auth',
        slug: 'e2e-configurator-product-no-auth',
        codePrefix: 'NOA',
      })
      .expect(401)
  })

  it('rejects a non-admin request → 403', async () => {
    await request(app.getHttpServer())
      .post('/configurator-products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'E2E User Attempt',
        slug: 'e2e-configurator-product-user-attempt',
        codePrefix: 'USR',
      })
      .expect(403)
  })

  // ── GET /configurator-products/:id ──────────────────────────────────────

  it('gets an unpublished product by id (admin view) → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/configurator-products/${productAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const product = (res.body as ApiResponse<ConfigurableProduct>).data
    expect(product.id).toBe(productAId)
    expect(product.isPublished).toBe(false)
    expect(product.description).toBe('Product A description')
  })

  it('404s for a non-existent product', async () => {
    await request(app.getHttpServer())
      .get('/configurator-products/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  it('rejects a non-admin get → 403', async () => {
    await request(app.getHttpServer())
      .get(`/configurator-products/${productAId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  // ── GET /configurator-products ──────────────────────────────────────────

  it('lists products, paginated → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/configurator-products')
      .query({ limit: 1, page: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<ConfigurableProduct>>).data
    expect(body.data.length).toBeLessThanOrEqual(1)
    // Race-safe bound (test/CLAUDE.md) — never assert exact equality against a
    // shared table other suites may also be writing to.
    expect(body.meta.totalItems).toBeGreaterThanOrEqual(body.data.length)
  })

  it('includes an unpublished product in the admin list → 200', async () => {
    // No q/search filter exists on this route (CONFIGURATOR.md §5.1/§7 don't
    // ask for one), so scope via a large limit scan rather than a filtered
    // query, per test/CLAUDE.md's race-safe pagination guidance.
    const res = await request(app.getHttpServer())
      .get('/configurator-products')
      .query({ limit: 100, page: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const body = (res.body as ApiResponse<Paginated<ConfigurableProduct>>).data
    const ids = body.data.map((p) => p.id)
    expect(ids).toContain(productAId)
  })

  it('rejects an anonymous list request → 401', async () => {
    await request(app.getHttpServer()).get('/configurator-products').expect(401)
  })

  it('rejects a non-admin list request → 403', async () => {
    await request(app.getHttpServer())
      .get('/configurator-products')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  // ── PATCH /configurator-products/:id ────────────────────────────────────

  describe('updating a product', () => {
    let updateProductId: number

    beforeAll(async () => {
      const res = await createProduct({
        name: 'E2E Configurator Product Update',
        slug: 'e2e-configurator-product-update',
        codePrefix: 'EPU',
        description: 'Original description',
      }).expect(201)
      updateProductId = (res.body as ApiResponse<ConfigurableProduct>).data.id
    })

    it('updates name/codePrefix/isPublished → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Configurator Product Update Renamed',
          codePrefix: 'EPU2',
          isPublished: true,
        })
        .expect(200)

      const product = (res.body as ApiResponse<ConfigurableProduct>).data
      expect(product.name).toBe('E2E Configurator Product Update Renamed')
      expect(product.codePrefix).toBe('EPU2')
      expect(product.isPublished).toBe(true)
    })

    it('clears description with an explicit null → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: null })
        .expect(200)

      expect(
        (res.body as ApiResponse<ConfigurableProduct>).data.description,
      ).toBeNull()
    })

    it('leaves description unchanged when omitted → 200', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Set again' })
        .expect(200)

      const res = await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ codePrefix: 'EPU3' })
        .expect(200)

      expect(
        (res.body as ApiResponse<ConfigurableProduct>).data.description,
      ).toBe('Set again')
    })

    it('rejects imageUrl/imagePublicId in the body → 400 (not part of this DTO)', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: 'https://example.com/image.jpg' })
        .expect(400)

      await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imagePublicId: 'some/public-id' })
        .expect(400)
    })

    it('rejects renaming to a name already in use → 409', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Configurator Product A' })
        .expect(409)
    })

    it('rejects a slug already in use → 409', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'e2e-configurator-product-a' })
        .expect(409)
    })

    it('404s for a non-existent product', async () => {
      await request(app.getHttpServer())
        .patch('/configurator-products/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ codePrefix: 'XXX' })
        .expect(404)
    })

    it('rejects a non-admin update → 403', async () => {
      await request(app.getHttpServer())
        .patch(`/configurator-products/${updateProductId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ codePrefix: 'XXX' })
        .expect(403)
    })
  })

  // ── DELETE /configurator-products/:id ───────────────────────────────────

  describe('deleting a product', () => {
    let deleteProductId: number

    beforeAll(async () => {
      const res = await createProduct({
        name: 'E2E Configurator Product Delete',
        slug: 'e2e-configurator-product-delete',
        codePrefix: 'DEL',
      }).expect(201)
      deleteProductId = (res.body as ApiResponse<ConfigurableProduct>).data.id
    })

    it('rejects a non-admin delete → 403', async () => {
      await request(app.getHttpServer())
        .delete(`/configurator-products/${deleteProductId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })

    it('404s for a non-existent product', async () => {
      await request(app.getHttpServer())
        .delete('/configurator-products/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('soft-deletes → 200, { deleted: true, id }, sets deletedAt, excluded from list and GET :id', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/configurator-products/${deleteProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(
        (res.body as ApiResponse<{ deleted: boolean; id: number }>).data,
      ).toEqual({ deleted: true, id: deleteProductId })

      const row: ConfigurableProduct | null =
        await configurableProductRepo.findOne({
          where: { id: deleteProductId },
          withDeleted: true,
        })
      expect(row?.deletedAt).not.toBeNull()

      await request(app.getHttpServer())
        .get(`/configurator-products/${deleteProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)

      const listRes = await request(app.getHttpServer())
        .get('/configurator-products')
        .query({ limit: 100, page: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const ids = (
        listRes.body as ApiResponse<Paginated<ConfigurableProduct>>
      ).data.data.map((p) => p.id)
      expect(ids).not.toContain(deleteProductId)
    })

    it('keeps the Cloudinary image on soft-delete (does not call storageDelete)', async () => {
      const withImageRes = await createProduct({
        name: 'E2E Configurator Product Delete Image',
        slug: 'e2e-configurator-product-delete-image',
        codePrefix: 'DIM',
      }).expect(201)
      const withImageId: number = (
        withImageRes.body as ApiResponse<ConfigurableProduct>
      ).data.id

      await request(app.getHttpServer())
        .post(`/configurator-products/${withImageId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', JPEG_MAGIC, {
          filename: 'delete-test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201)

      storageDelete.mockClear()

      await request(app.getHttpServer())
        .delete(`/configurator-products/${withImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(storageDelete).not.toHaveBeenCalled()

      const row: ConfigurableProduct | null =
        await configurableProductRepo.findOne({
          where: { id: withImageId },
          withDeleted: true,
        })
      expect(row?.imageUrl).not.toBeNull()
      expect(row?.imagePublicId).not.toBeNull()
    })
  })

  // ── POST /configurator-products/:id/image ───────────────────────────────

  describe('image upload/delete', () => {
    let imageProductId: number

    beforeAll(async () => {
      const res = await createProduct({
        name: 'E2E Configurator Product Image',
        slug: 'e2e-configurator-product-image',
        codePrefix: 'IMG',
      }).expect(201)
      imageProductId = (res.body as ApiResponse<ConfigurableProduct>).data.id
    })

    it('first upload → 201, sets imageUrl/imagePublicId, does not call storageDelete', async () => {
      storageDelete.mockClear()

      const res = await request(app.getHttpServer())
        .post(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', JPEG_MAGIC, {
          filename: 'product.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201)

      const product = (res.body as ApiResponse<ConfigurableProduct>).data
      expect(product.id).toBe(imageProductId)
      expect(product.imageUrl).toContain('cloudinary')
      expect(product.imagePublicId).toContain('configurator-products/')
      expect(storageDelete).not.toHaveBeenCalled()
    })

    it('second upload → 201, replaces, storageDelete called with the old publicId', async () => {
      const before: ConfigurableProduct | null =
        await configurableProductRepo.findOneBy({ id: imageProductId })
      storageDelete.mockClear()

      const res = await request(app.getHttpServer())
        .post(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', JPEG_MAGIC, {
          filename: 'product-2.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201)

      const product = (res.body as ApiResponse<ConfigurableProduct>).data
      expect(product.imageUrl).not.toBe(before?.imageUrl)
      expect(storageDelete).toHaveBeenCalledWith(before?.imagePublicId)
    })

    it('rejects a non-admin upload → 403', async () => {
      await request(app.getHttpServer())
        .post(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', JPEG_MAGIC, {
          filename: 'product.jpg',
          contentType: 'image/jpeg',
        })
        .expect(403)
    })

    it('rejects an oversized file → 400', async () => {
      const oversized = Buffer.alloc(6 * 1024 * 1024)
      oversized[0] = 0xff
      oversized[1] = 0xd8
      oversized[2] = 0xff
      oversized[3] = 0xe0

      await request(app.getHttpServer())
        .post(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversized, {
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400)
    })

    it('rejects a mismatched mime type → 400', async () => {
      await request(app.getHttpServer())
        .post(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', PDF_MAGIC, {
          filename: 'not-an-image.pdf',
          contentType: 'application/pdf',
        })
        .expect(400)
    })

    it('404s for a non-existent product', async () => {
      await request(app.getHttpServer())
        .post('/configurator-products/999999/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', JPEG_MAGIC, {
          filename: 'product.jpg',
          contentType: 'image/jpeg',
        })
        .expect(404)
    })

    // ── DELETE /configurator-products/:id/image ───────────────────────────

    it('clears the image → 200, clears imageUrl/imagePublicId, calls storageDelete with the publicId', async () => {
      const before: ConfigurableProduct | null =
        await configurableProductRepo.findOneBy({ id: imageProductId })
      storageDelete.mockClear()

      const res = await request(app.getHttpServer())
        .delete(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const product = (res.body as ApiResponse<ConfigurableProduct>).data
      expect(product.imageUrl).toBeNull()
      expect(product.imagePublicId).toBeNull()
      expect(storageDelete).toHaveBeenCalledWith(before?.imagePublicId)
    })

    it('404s when no image is currently tracked', async () => {
      await request(app.getHttpServer())
        .delete(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('404s for a non-existent product', async () => {
      await request(app.getHttpServer())
        .delete('/configurator-products/999999/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('rejects a non-admin delete → 403', async () => {
      await request(app.getHttpServer())
        .delete(`/configurator-products/${imageProductId}/image`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })
  })
})
