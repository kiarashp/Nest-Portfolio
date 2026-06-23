import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { MetaOption } from '../../src/meta-options/entities/meta-option.entity'
import { Post } from '../../src/posts/entities/post.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('MetaOptions (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let authorToken: string
  let otherToken: string
  let adminToken: string

  let postId: number
  let metaOptionId: number

  const AUTHOR_EMAIL = 'meta-author@e2e.test'
  const OTHER_EMAIL = 'meta-other@e2e.test'
  const ADMIN_EMAIL = 'meta-admin@e2e.test'
  const PASSWORD = 'Password1!'

  const META_VALUE = '{"seo": "e2e-test"}'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Pre-cleanup: remove stale rows from a previous failed run.
    await dataSource
      .getRepository(Post)
      .delete({ slug: 'e2e-meta-options-post' })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, OTHER_EMAIL, ADMIN_EMAIL])

    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'MetaAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: OTHER_EMAIL,
      password: PASSWORD,
      firstName: 'MetaOther',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'MetaAdmin',
      role: UserRole.ADMIN,
    })

    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    otherToken = await getAuthToken(app, OTHER_EMAIL, PASSWORD)
    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)

    // Create a post with metaOptions via HTTP — this cascade-creates the MetaOption row.
    const postRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Meta Options Post',
        postType: 'post',
        slug: 'e2e-meta-options-post',
        status: 'draft',
        metaOptions: { metaValue: META_VALUE },
      })
      .expect(201)

    const post = (postRes.body as ApiResponse<Post>).data
    postId = post.id
    metaOptionId = post.metaOptions!.id
  })

  afterAll(async () => {
    // Post deletion cascade-deletes MetaOption if it still exists.
    await dataSource.getRepository(Post).delete({ id: postId })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, OTHER_EMAIL, ADMIN_EMAIL])
    await app.close()
  })

  // ── POST /meta-options (removed) ──────────────────────────────────────────

  it('POST /meta-options (AUTHOR) → 404 — route no longer exists', async () => {
    await request(app.getHttpServer())
      .post('/meta-options')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ metaValue: '{"test": true}' })
      .expect(404)
  })

  // ── GET /meta-options/:id ─────────────────────────────────────────────────

  it('GET /meta-options/:id (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .get(`/meta-options/${metaOptionId}`)
      .expect(401)
  })

  it('GET /meta-options/:id (as owner) → 200 with metaOption data', async () => {
    const res = await request(app.getHttpServer())
      .get(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const metaOption = (res.body as ApiResponse<MetaOption>).data
    expect(metaOption.id).toBe(metaOptionId)
    expect(metaOption.metaValue).toBe(META_VALUE)
  })

  it('GET /meta-options/:id (as non-owner AUTHOR) → 200 — read is not ownership-gated', async () => {
    const res = await request(app.getHttpServer())
      .get(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200)

    expect((res.body as ApiResponse<MetaOption>).data.id).toBe(metaOptionId)
  })

  it('GET /meta-options/:id (as ADMIN) → 200', async () => {
    await request(app.getHttpServer())
      .get(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
  })

  it('GET /meta-options/99999 (non-existent) → 404', async () => {
    await request(app.getHttpServer())
      .get('/meta-options/99999')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(404)
  })

  // ── PATCH /meta-options/:id ───────────────────────────────────────────────

  it('PATCH /meta-options/:id (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .patch(`/meta-options/${metaOptionId}`)
      .send({ metaValue: '{"updated": true}' })
      .expect(401)
  })

  it('PATCH /meta-options/:id (as non-owner AUTHOR) → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ metaValue: '{"should": "fail"}' })
      .expect(403)
  })

  it('PATCH /meta-options/:id (as owner) → 200 with updated metaValue', async () => {
    const updated = '{"seo": "updated-by-owner"}'
    const res = await request(app.getHttpServer())
      .patch(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ metaValue: updated })
      .expect(200)

    const metaOption = (res.body as ApiResponse<MetaOption>).data
    expect(metaOption.id).toBe(metaOptionId)
    expect(metaOption.metaValue).toBe(updated)
  })

  it('PATCH /meta-options/:id (as ADMIN, not owner) → 200', async () => {
    const updated = '{"seo": "updated-by-admin"}'
    const res = await request(app.getHttpServer())
      .patch(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ metaValue: updated })
      .expect(200)

    expect((res.body as ApiResponse<MetaOption>).data.metaValue).toBe(updated)
  })

  it('PATCH /meta-options/99999 (non-existent) → 404', async () => {
    await request(app.getHttpServer())
      .patch('/meta-options/99999')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ metaValue: '{"ghost": true}' })
      .expect(404)
  })

  // ── DELETE /meta-options/:id ──────────────────────────────────────────────

  it('DELETE /meta-options/:id (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .delete(`/meta-options/${metaOptionId}`)
      .expect(401)
  })

  it('DELETE /meta-options/:id (as non-owner AUTHOR) → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403)
  })

  it('DELETE /meta-options/:id (as owner) → 200 with { deleted: true, id }', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/meta-options/${metaOptionId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    expect(
      (res.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: metaOptionId })

    // The MetaOption row must be gone from the DB.
    const row: MetaOption | null = await dataSource
      .getRepository(MetaOption)
      .findOneBy({ id: metaOptionId })
    expect(row).toBeNull()
  })

  it('After DELETE, the post still exists in DB with metaOptions null', async () => {
    // GET /posts/:id is published-only so we confirm post survival via the DB.
    // metaOptions is eager on Post so findOneBy loads it automatically.
    const post: Post | null = await dataSource
      .getRepository(Post)
      .findOneBy({ id: postId })
    expect(post).not.toBeNull()
    expect(post!.metaOptions).toBeNull()
  })
})
