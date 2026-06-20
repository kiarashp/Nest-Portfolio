import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Tag } from '../../src/tags/entities/tag.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('Tags (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let authorToken: string
  let userToken: string

  // Track IDs of tags created during tests so afterAll can clean them up.
  const createdTagIds: number[] = []

  const AUTHOR_EMAIL = 'tags-author@e2e.test'
  const USER_EMAIL = 'tags-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Seed an AUTHOR who can create and delete tags, and a plain USER who must
    // be blocked from write operations.
    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'TagsAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'TagsUser',
    })

    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)
  })

  afterAll(async () => {
    const tagRepo = dataSource.getRepository(Tag)
    // Clean up any tags that were not deleted during the tests.
    if (createdTagIds.length) {
      await tagRepo.delete(createdTagIds)
    }
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── GET /tags ─────────────────────────────────────────────────────────────

  it('GET /tags (public) → 200 with an array', async () => {
    const res = await request(app.getHttpServer()).get('/tags').expect(200)
    expect(Array.isArray((res.body as ApiResponse<Tag[]>).data)).toBe(true)
  })

  // ── POST /tags ────────────────────────────────────────────────────────────

  it('POST /tags (AUTHOR) → 201 with the created tag', async () => {
    const res = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'e2e-tag-create', slug: 'e2e-tag-create' })
      .expect(201)

    const tag = (res.body as ApiResponse<Tag>).data
    expect(tag.id).toBeDefined()
    expect(tag.name).toBe('e2e-tag-create')
    createdTagIds.push(tag.id)
  })

  it('POST /tags (no token) → 401', async () => {
    await request(app.getHttpServer())
      .post('/tags')
      .send({ name: 'e2e-no-auth', slug: 'e2e-no-auth' })
      .expect(401)
  })

  it('POST /tags (USER role) → 403', async () => {
    // Regular USER is not AUTHOR or ADMIN, so the RolesGuard must block this.
    await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'e2e-user-tag', slug: 'e2e-user-tag' })
      .expect(403)
  })

  it('POST /tags (missing required slug) → 400', async () => {
    // Both `name` and `slug` are required — the ValidationPipe should reject this.
    await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'only-name-no-slug' })
      .expect(400)
  })

  // ── DELETE /tags/:id (hard delete) ────────────────────────────────────────

  it('DELETE /tags/:id (AUTHOR) → 200 and tag is gone from DB', async () => {
    // Create a tag specifically for this test so no other test depends on it.
    const createRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'e2e-hard-delete', slug: 'e2e-hard-delete' })
      .expect(201)

    const id: number = (createRes.body as ApiResponse<Tag>).data.id

    const deleteRes = await request(app.getHttpServer())
      .delete(`/tags/${id}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    expect(
      (deleteRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id })

    // The row must be physically gone — no soft-delete artefact.
    const tag = await dataSource.getRepository(Tag).findOneBy({ id })
    expect(tag).toBeNull()
  })

  it('DELETE /tags/:id (USER role) → 403', async () => {
    // Create a throwaway tag just to have a valid ID.
    const createRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'e2e-delete-forbidden', slug: 'e2e-delete-forbidden' })
      .expect(201)

    const id: number = (createRes.body as ApiResponse<Tag>).data.id
    createdTagIds.push(id)

    await request(app.getHttpServer())
      .delete(`/tags/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  // ── DELETE /tags/soft/:id (soft delete) ───────────────────────────────────

  it('DELETE /tags/soft/:id (AUTHOR) → 200 and deletedAt is set in DB', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'e2e-soft-delete', slug: 'e2e-soft-delete' })
      .expect(201)

    const id: number = (createRes.body as ApiResponse<Tag>).data.id

    const deleteRes = await request(app.getHttpServer())
      .delete(`/tags/soft/${id}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    expect(
      (deleteRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id })

    // The row still exists but must have deletedAt set (soft delete).
    const tag = await dataSource
      .getRepository(Tag)
      .findOne({ where: { id }, withDeleted: true })
    expect(tag).not.toBeNull()
    expect(tag?.deletedAt).toBeDefined()

    // Clean up the soft-deleted row with a hard delete.
    await dataSource.getRepository(Tag).delete(id)
  })
})
