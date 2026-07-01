import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Post } from '../../src/posts/entities/post.entity'
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

// Distinctive term that will not appear in any other spec's post data.
const ADMIN_TERM = 'AdminViewUniqTrm8Kq'

describe('GET /posts/admin (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let adminToken: string
  let authorToken: string
  let editorToken: string

  let adminPublishedPostId: number
  let authorDraftPostId: number
  let authorPublishedPostId: number

  const ADMIN_EMAIL = 'admin-posts-admin@e2e.test'
  const AUTHOR_EMAIL = 'admin-posts-author@e2e.test'
  const EDITOR_EMAIL = 'admin-posts-editor@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)

    // Pre-cleanup: remove rows from any previous failed run.
    for (const slug of [
      'admin-view-published',
      'admin-view-draft',
      'admin-view-author-pub',
    ]) {
      await postRepo.delete({ slug })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, AUTHOR_EMAIL, EDITOR_EMAIL])

    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'AdminPostsAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'AdminPostsAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: EDITOR_EMAIL,
      password: PASSWORD,
      firstName: 'AdminPostsEditor',
      role: UserRole.EDITOR,
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    editorToken = await getAuthToken(app, EDITOR_EMAIL, PASSWORD)

    // Admin creates a published post — each title contains ADMIN_TERM for scoped searches.
    const adminPubRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${ADMIN_TERM} Admin Published Post`,
        slug: 'admin-view-published',
        status: 'published',
      })
    adminPublishedPostId = (adminPubRes.body as ApiResponse<Post>).data.id

    // Author creates a draft post — admin must see this even though it is not published.
    const authorDraftRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: `${ADMIN_TERM} Author Draft Post`,
        slug: 'admin-view-draft',
        status: 'draft',
      })
    authorDraftPostId = (authorDraftRes.body as ApiResponse<Post>).data.id

    // Author creates a published post.
    const authorPubRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: `${ADMIN_TERM} Author Published Post`,
        slug: 'admin-view-author-pub',
        status: 'published',
      })
    authorPublishedPostId = (authorPubRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const ids = [
      adminPublishedPostId,
      authorDraftPostId,
      authorPublishedPostId,
    ].filter(Boolean)
    if (ids.length) {
      await postRepo.delete(ids)
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, AUTHOR_EMAIL, EDITOR_EMAIL])
    await app.close()
  })

  // ── GET /posts/admin ──────────────────────────────────────────────────────

  it('GET /posts/admin (unauthenticated) → 401', async () => {
    await request(app.getHttpServer()).get('/posts/admin').expect(401)
  })

  it('GET /posts/admin (AUTHOR) → 200 with draft and published posts from all authors', async () => {
    // AUTHOR has unrestricted write access to all posts, so they must also be able to list them.
    const res = await request(app.getHttpServer())
      .get('/posts/admin')
      .query({ q: ADMIN_TERM })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    // Author must see drafts written by other users (admin's post) as well as their own.
    expect(ids).toContain(adminPublishedPostId)
    expect(ids).toContain(authorDraftPostId)
  })

  it('GET /posts/admin (EDITOR) → 403', async () => {
    await request(app.getHttpServer())
      .get('/posts/admin')
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(403)
  })

  it('GET /posts/admin (ADMIN) → 200 with draft and published posts from all authors', async () => {
    // Use q to scope to our test posts so pagination does not cut them off.
    const res = await request(app.getHttpServer())
      .get('/posts/admin')
      .query({ q: ADMIN_TERM })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(Array.isArray(paginated.data)).toBe(true)

    const ids = paginated.data.map((p) => p.id)
    // Must include the author's draft — this is the core difference from GET /posts.
    expect(ids).toContain(authorDraftPostId)
    expect(ids).toContain(adminPublishedPostId)
    expect(ids).toContain(authorPublishedPostId)
  })

  it('GET /posts/admin?status=draft → only draft posts returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/admin')
      .query({ q: ADMIN_TERM, status: 'draft' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data.length).toBeGreaterThan(0)
    paginated.data.forEach((p) => {
      expect(p.status).toBe('draft')
    })
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toContain(authorDraftPostId)
    expect(ids).not.toContain(adminPublishedPostId)
  })

  it('GET /posts/admin?status=published → only published posts returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/admin')
      .query({ q: ADMIN_TERM, status: 'published' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data.length).toBeGreaterThan(0)
    paginated.data.forEach((p) => {
      expect(p.status).toBe('published')
    })
    const ids = paginated.data.map((p) => p.id)
    expect(ids).not.toContain(authorDraftPostId)
  })

  it('GET /posts/admin vs GET /posts — public does not expose the same draft', async () => {
    // The public endpoint must never return the author's draft post.
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: ADMIN_TERM })
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Post>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).not.toContain(authorDraftPostId)
  })

  // ── GET /posts/:id/admin ────────────────────────────────────────────────

  it('GET /posts/:id/admin (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${authorDraftPostId}/admin`)
      .expect(401)
  })

  it('GET /posts/:id/admin (ADMIN) → 200 and returns a draft post', async () => {
    // This is the whole point of the endpoint: GET /posts/:id (published-only)
    // 404s on a draft, but /admin fetches it regardless of status.
    const res = await request(app.getHttpServer())
      .get(`/posts/${authorDraftPostId}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.id).toBe(authorDraftPostId)
    expect(post.status).toBe('draft')
  })

  it('GET /posts/:id/admin (AUTHOR) → 200 for a draft authored by someone else', async () => {
    const res = await request(app.getHttpServer())
      .get(`/posts/${authorDraftPostId}/admin`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.id).toBe(authorDraftPostId)
  })

  it('GET /posts/:id/admin (EDITOR) → 403 for a draft authored by someone else', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${authorDraftPostId}/admin`)
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(403)
  })

  it('GET /posts/:id/admin → 404 for a non-existent post', async () => {
    await request(app.getHttpServer())
      .get('/posts/999999999/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  it('GET /posts/:id (published-only) → 404 on the same draft that /admin can fetch', async () => {
    // Confirms the gap this endpoint fills: the public single-post route
    // cannot be used to load a draft for editing.
    await request(app.getHttpServer())
      .get(`/posts/${authorDraftPostId}`)
      .expect(404)
  })
})
