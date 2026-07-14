import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { ConfigurableProduct } from '../../src/configurator/entities/configurable-product.entity'
import { ConfiguratorListItemDto } from '../../src/configurator/dtos/configurator-list-item.dto'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Exercises the public browse/list endpoint (GET /configurators): a bare,
// unpaginated array of published configurators, curated to
// slug/name/description/imageUrl, ordered by name. Since this route has no
// scoping query param, other e2e suites' published configurable products
// also appear in the response — assertions are scoped to this suite's own
// seeded slugs rather than exact array equality, per test/CLAUDE.md's
// whole-table-aggregate guidance.
describe('Configurator public list (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let adminToken: string

  let configurableProductRepo: Repository<ConfigurableProduct>

  const ADMIN_EMAIL = 'configurator-list-admin@e2e.test'
  const PASSWORD = 'Password1!'

  const PUBLISHED_SLUG = 'e2e-configurator-list-published'
  const UNPUBLISHED_SLUG = 'e2e-configurator-list-unpublished'
  const DELETED_SLUG = 'e2e-configurator-list-deleted'
  const ORDER_A_SLUG = 'e2e-configurator-list-order-aaa'
  const ORDER_Z_SLUG = 'e2e-configurator-list-order-zzz'
  const SLUGS = [
    PUBLISHED_SLUG,
    UNPUBLISHED_SLUG,
    DELETED_SLUG,
    ORDER_A_SLUG,
    ORDER_Z_SLUG,
  ]

  const createProduct = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/configurator-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  const getList = () => request(app.getHttpServer()).get('/configurators')

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

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
    await cleanupUsers(dataSource, [ADMIN_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'ConfiguratorListAdmin',
      role: UserRole.ADMIN,
    })
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)

    await createProduct({
      name: 'E2E List Published Product',
      slug: PUBLISHED_SLUG,
      codePrefix: 'ELP',
      description: 'Published product description',
      isPublished: true,
    }).expect(201)

    await createProduct({
      name: 'E2E List Unpublished Product',
      slug: UNPUBLISHED_SLUG,
      codePrefix: 'ELU',
      isPublished: false,
    }).expect(201)

    const deletedRes = await createProduct({
      name: 'E2E List Deleted Product',
      slug: DELETED_SLUG,
      codePrefix: 'ELD',
      isPublished: true,
    }).expect(201)
    const deletedId = (deletedRes.body as ApiResponse<ConfigurableProduct>).data
      .id
    await request(app.getHttpServer())
      .delete(`/configurator-products/${deletedId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    await createProduct({
      name: 'AAA E2E List Order Product',
      slug: ORDER_A_SLUG,
      codePrefix: 'ELA',
      isPublished: true,
    }).expect(201)

    await createProduct({
      name: 'ZZZ E2E List Order Product',
      slug: ORDER_Z_SLUG,
      codePrefix: 'ELZ',
      isPublished: true,
    }).expect(201)
  })

  afterAll(async () => {
    const rows = await configurableProductRepo.find({
      where: SLUGS.map((slug) => ({ slug })),
      withDeleted: true,
    })
    if (rows.length > 0) {
      await configurableProductRepo.delete(rows.map((p) => p.id))
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL])
    await app.close()
  })

  // ── GET /configurators ──────────────────────────────────────────────

  it('is public and returns a bare array, not a paginated envelope', async () => {
    const res = await getList().expect(200)
    const data = (res.body as ApiResponse<ConfiguratorListItemDto[]>).data
    expect(Array.isArray(data)).toBe(true)
  })

  it('includes a published configurator with the curated shape only', async () => {
    const res = await getList().expect(200)
    const data = (res.body as ApiResponse<ConfiguratorListItemDto[]>).data
    const item = data.find((p) => p.slug === PUBLISHED_SLUG)
    expect(item).toBeDefined()
    expect(Object.keys(item!).sort()).toEqual(
      ['slug', 'name', 'description', 'imageUrl'].sort(),
    )
    expect(item).toMatchObject({
      slug: PUBLISHED_SLUG,
      name: 'E2E List Published Product',
      description: 'Published product description',
      imageUrl: null,
    })
  })

  it('excludes unpublished and soft-deleted configurators', async () => {
    const res = await getList().expect(200)
    const data = (res.body as ApiResponse<ConfiguratorListItemDto[]>).data
    const slugs = data.map((p) => p.slug)
    expect(slugs).not.toContain(UNPUBLISHED_SLUG)
    expect(slugs).not.toContain(DELETED_SLUG)
  })

  it('orders published configurators by name ascending', async () => {
    const res = await getList().expect(200)
    const data = (res.body as ApiResponse<ConfiguratorListItemDto[]>).data
    const slugs = data.map((p) => p.slug)
    expect(slugs.indexOf(ORDER_A_SLUG)).toBeLessThan(
      slugs.indexOf(ORDER_Z_SLUG),
    )
  })
})
