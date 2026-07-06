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

describe('GET /posts/my (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let authorToken: string
  let editorToken: string

  // Post IDs tracked for cleanup
  let authorPublishedPostId: number
  let authorDraftPostId: number
  let editorPostId: number
  let authorSearchPostId: number

  const AUTHOR_EMAIL = 'my-posts-author@e2e.test'
  const EDITOR_EMAIL = 'my-posts-editor@e2e.test'
  const PASSWORD = 'Password1!'
  // Distinctive term guaranteed not to appear in other spec fixtures.
  const MY_SEARCH_TERM = 'MyPostsUniqSrchTrm4Zx'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)

    // Pre-cleanup: remove any rows from a previous failed run.
    for (const slug of [
      'my-posts-published',
      'my-posts-draft',
      'my-posts-editor',
      'my-posts-search',
    ]) {
      await postRepo.delete({ slug })
    }
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL])

    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'MyPostsAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: EDITOR_EMAIL,
      password: PASSWORD,
      firstName: 'MyPostsEditor',
      role: UserRole.EDITOR,
    })

    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    editorToken = await getAuthToken(app, EDITOR_EMAIL, PASSWORD)

    // Author owns one published and one draft post.
    const publishedRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'My Published Post',
        slug: 'my-posts-published',
        status: 'published',
      })
    authorPublishedPostId = (publishedRes.body as ApiResponse<Post>).data.id

    const draftRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'My Draft Post',
        slug: 'my-posts-draft',
        status: 'draft',
      })
    authorDraftPostId = (draftRes.body as ApiResponse<Post>).data.id

    // Editor owns a separate post to test isolation.
    const editorRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Editor Post',
        slug: 'my-posts-editor',
        status: 'published',
      })
    editorPostId = (editorRes.body as ApiResponse<Post>).data.id

    // Author creates a post with a distinctive term in the title for q-search tests.
    const searchRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: `Post with ${MY_SEARCH_TERM} in title`,
        slug: 'my-posts-search',
        status: 'draft',
      })
    authorSearchPostId = (searchRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const ids = [
      authorPublishedPostId,
      authorDraftPostId,
      editorPostId,
      authorSearchPostId,
    ].filter(Boolean)
    if (ids.length) {
      await postRepo.delete(ids)
    }
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL])
    await app.close()
  })

  // ── GET /posts/my ─────────────────────────────────────────────────────────

  it('GET /posts/my (unauthenticated) → 401', async () => {
    await request(app.getHttpServer()).get('/posts/my').expect(401)
  })

  it('GET /posts/my (AUTHOR) → 200 with all own posts including drafts', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(Array.isArray(paginated.data)).toBe(true)
    expect(paginated.meta).toBeDefined()

    const ids = paginated.data.map((p) => p.id)
    // Draft post must appear — this is the key difference from the public endpoint.
    expect(ids).toContain(authorDraftPostId)
    expect(ids).toContain(authorPublishedPostId)
  })

  it('GET /posts/my?status=draft → only draft posts returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .query({ status: 'draft' })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data.length).toBeGreaterThan(0)
    paginated.data.forEach((p) => {
      expect(p.status).toBe('draft')
    })
  })

  it('GET /posts/my?status=published → only published own posts returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .query({ status: 'published' })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data.length).toBeGreaterThan(0)
    paginated.data.forEach((p) => {
      expect(p.status).toBe('published')
    })
  })

  it('GET /posts/my (AUTHOR) → does not return posts owned by another user', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    // Editor's post must NOT appear in author's list.
    expect(ids).not.toContain(editorPostId)
  })

  // ── GET /posts/my?q= (keyword search) ────────────────────────────────────

  it('GET /posts/my?q=<term> → returns own posts matching title', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .query({ q: MY_SEARCH_TERM })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toContain(authorSearchPostId)
    // Other author posts without the term must not appear.
    expect(ids).not.toContain(authorPublishedPostId)
  })

  it('GET /posts/my?q=<term> → does not return matching posts from other users', async () => {
    // The editor does not own authorSearchPostId, so querying with the same term
    // as EDITOR should return an empty list.
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .query({ q: MY_SEARCH_TERM })
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Post>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).not.toContain(authorSearchPostId)
  })

  it('GET /posts/my?q=<no match> → 200 with empty data', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .query({ q: 'zzz_no_match_9xq99999' })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data).toHaveLength(0)
  })

  // ── GET /posts/my?sortBy / order ─────────────────────────────────────────

  it('GET /posts/my?sortBy=title&order=asc → alphabetical by title', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts/my')
      .query({ sortBy: 'title', order: 'asc' })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toEqual([
      authorDraftPostId,
      authorPublishedPostId,
      authorSearchPostId,
    ])
  })

  it('GET /posts/my?sortBy=invalidField → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts/my')
      .query({ sortBy: 'invalidField' })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(400)
  })
})
