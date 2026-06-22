import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { User } from '../../src/users/entities/user.entity'
import { AvatarOption } from '../../src/users/entities/avatar-option.entity'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// URL returned by the default StorageProvider mock in create-app.helper.ts
const MOCK_URL =
  'https://res.cloudinary.com/mock/image/upload/v1/avatars/test.jpg'
const MOCK_PUBLIC_ID = 'avatars/test'

// Minimal JPEG buffer — starts with the SOI + APP0 JFIF magic bytes that
// the file-type package needs to detect this as image/jpeg.
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
])

describe('Avatar selection (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let avatarOptionRepo: Repository<AvatarOption>
  let userToken: string
  let adminToken: string
  // Options seeded directly in the DB — used by PATCH /users/avatar tests.
  let seededOption: AvatarOption
  let seededOption2: AvatarOption
  // Id of the option created by POST /users/avatar-options, used by the DELETE test.
  let createdOptionId: number

  const USER_EMAIL = 'avatar-select@e2e.test'
  const ADMIN_EMAIL = 'avatar-admin@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())
    avatarOptionRepo = dataSource.getRepository(AvatarOption)

    await cleanupUsers(dataSource, [USER_EMAIL, ADMIN_EMAIL])

    await seedUser(dataSource, { email: USER_EMAIL, password: PASSWORD })
    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      role: UserRole.ADMIN,
    })

    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)

    // Seed two options directly — tests for PATCH /users/avatar don't need to
    // go through the upload API and shouldn't depend on Cloudinary mocks.
    seededOption = await avatarOptionRepo.save({
      url: 'https://res.cloudinary.com/test/avatar-1.jpg',
      publicId: 'avatars/seed-1',
    })
    seededOption2 = await avatarOptionRepo.save({
      url: 'https://res.cloudinary.com/test/avatar-2.jpg',
      publicId: 'avatars/seed-2',
    })
  })

  afterAll(async () => {
    // Clean up any options that tests may have left behind.
    await avatarOptionRepo.delete(seededOption.id)
    await avatarOptionRepo.delete(seededOption2.id)
    if (createdOptionId) await avatarOptionRepo.delete(createdOptionId)
    await cleanupUsers(dataSource, [USER_EMAIL, ADMIN_EMAIL])
    await app.close()
  })

  // ── GET /users/avatar-options ─────────────────────────────────────────────

  it('GET /users/avatar-options (unauthenticated) → 200, includes seeded options', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/avatar-options')
      .expect(200)

    const options = (res.body as ApiResponse<AvatarOption[]>).data
    expect(Array.isArray(options)).toBe(true)
    expect(options.some((o) => o.id === seededOption.id)).toBe(true)
    for (const option of options) {
      expect(option).toHaveProperty('id')
      expect(option).toHaveProperty('url')
    }
  })

  // ── POST /users/avatar-options ────────────────────────────────────────────

  it('POST /users/avatar-options (admin, valid file) → 201, option saved with mock URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/avatar-options')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)

    const option = (res.body as ApiResponse<AvatarOption>).data
    expect(option.url).toBe(MOCK_URL)
    expect(option.publicId).toBe(MOCK_PUBLIC_ID)

    createdOptionId = option.id
    const inDb: AvatarOption | null = await avatarOptionRepo.findOne({
      where: { id: option.id },
    })
    expect(inDb).not.toBeNull()
    expect(inDb!.url).toBe(MOCK_URL)
  })

  it('POST /users/avatar-options (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post('/users/avatar-options')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403)
  })

  // ── DELETE /users/avatar-options/:id ─────────────────────────────────────

  it('DELETE /users/avatar-options/:id (admin) → 200, row gone from DB', async () => {
    expect(createdOptionId).toBeDefined()

    await request(app.getHttpServer())
      .delete(`/users/avatar-options/${createdOptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const gone: AvatarOption | null = await avatarOptionRepo.findOne({
      where: { id: createdOptionId },
    })
    expect(gone).toBeNull()
    createdOptionId = 0 // mark as already cleaned up
  })

  it('DELETE /users/avatar-options/99999 → 404', async () => {
    await request(app.getHttpServer())
      .delete('/users/avatar-options/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  // ── PATCH /users/avatar ───────────────────────────────────────────────────

  it('PATCH /users/avatar with valid id → 200, avatarUrl updated', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/avatar')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ avatarOptionId: seededOption.id })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.avatarUrl).toBe(
      seededOption.url,
    )
  })

  it('GET /users/me after selection → avatarUrl matches chosen option', async () => {
    await request(app.getHttpServer())
      .patch('/users/avatar')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ avatarOptionId: seededOption2.id })
      .expect(200)

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)

    expect((res.body as ApiResponse<User>).data.avatarUrl).toBe(
      seededOption2.url,
    )
  })

  it('PATCH /users/avatar with unknown id → 400', async () => {
    await request(app.getHttpServer())
      .patch('/users/avatar')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ avatarOptionId: 999999 })
      .expect(400)
  })

  it('PATCH /users/avatar (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .patch('/users/avatar')
      .send({ avatarOptionId: seededOption.id })
      .expect(401)
  })
})
