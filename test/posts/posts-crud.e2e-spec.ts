import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Post } from '../../src/posts/entities/post.entity'
import { Tag } from '../../src/tags/entities/tag.entity'
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

describe('Posts CRUD (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let authorToken: string
  let editorToken: string
  let userToken: string

  // Post IDs captured in beforeAll for use across tests.
  let authorPublishedPostId: number
  let authorPublishedPostSlug: string
  let draftPostId: number
  let draftPostSlug: string
  let editorPostId: number
  let deletePostId: number // reserved for the DELETE test

  let tagId: number

  const AUTHOR_EMAIL = 'posts-author@e2e.test'
  const EDITOR_EMAIL = 'posts-editor@e2e.test'
  const USER_EMAIL = 'posts-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    // Pre-cleanup: delete any rows left by a previous failed run so seeds never
    // hit unique-constraint conflicts.  Posts must go first (FK to users/tags).
    for (const slug of [
      'e2e-published-post',
      'e2e-draft-post',
      'e2e-editor-post',
      'e2e-post-to-delete',
      'e2e-inline-create-post',
      'e2e-no-title', // left over if a previous run hit the old "missing title" test
      'e2e-published-on-create',
      'e2e-draft-no-published-at',
      'e2e-excerpt-post',
      'e2e-excerpt-too-long',
      'e2e-featured-post',
    ]) {
      await postRepo.delete({ slug })
    }
    await tagRepo.delete({ slug: 'e2e-post-tag' })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL, USER_EMAIL])

    // Seed three users with different roles.
    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'PostsAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: EDITOR_EMAIL,
      password: PASSWORD,
      firstName: 'PostsEditor',
      role: UserRole.EDITOR,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'PostsUser',
    })

    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    editorToken = await getAuthToken(app, EDITOR_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    // Seed a tag directly in the DB — needed as a post dependency.
    const tag = await tagRepo.save({
      name: 'e2e-post-tag',
      slug: 'e2e-post-tag',
    })
    tagId = tag.id

    // Create the posts that multiple tests will read.
    const authorPublishedRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Published Post',
        slug: 'e2e-published-post',
        status: 'published',
        tags: [tagId],
      })
    authorPublishedPostId = (authorPublishedRes.body as ApiResponse<Post>).data
      .id
    authorPublishedPostSlug = (authorPublishedRes.body as ApiResponse<Post>)
      .data.slug

    const draftRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Draft Post',
        slug: 'e2e-draft-post',
        status: 'draft',
      })
    draftPostId = (draftRes.body as ApiResponse<Post>).data.id
    draftPostSlug = (draftRes.body as ApiResponse<Post>).data.slug

    // EDITOR creates their own post so the ownership happy-path test works.
    const editorPostRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'E2E Editor Post',
        slug: 'e2e-editor-post',
        status: 'published',
      })
    editorPostId = (editorPostRes.body as ApiResponse<Post>).data.id

    // A separate post reserved for the DELETE test so other tests are unaffected.
    const deleteRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Post To Delete',
        slug: 'e2e-post-to-delete',
        status: 'published',
      })
    deletePostId = (deleteRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    // Delete all posts created in this suite (deletePostId may already be gone).
    const postIds = [
      authorPublishedPostId,
      draftPostId,
      editorPostId,
      deletePostId,
      ...extraPostIds,
    ].filter(Boolean)
    if (postIds.length) {
      await postRepo.delete(postIds)
    }

    await tagRepo.delete(tagId)
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL, USER_EMAIL])
    await app.close()
  })

  // Tracks IDs of posts created inside individual test cases.
  const extraPostIds: number[] = []

  // ── POST /posts ───────────────────────────────────────────────────────────

  it('POST /posts (AUTHOR) → 201 with the created post', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Inline Create Post',
        slug: 'e2e-inline-create-post',
        status: 'draft',
      })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.id).toBeDefined()
    expect(post.title).toBe('E2E Inline Create Post')
    extraPostIds.push(post.id)
  })

  it('POST /posts (no token) → 401', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .send({
        title: 'Unauthorized',
        slug: 'e2e-unauth',
        status: 'draft',
      })
      .expect(401)
  })

  it('POST /posts (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'User Post',
        slug: 'e2e-user-post',
        status: 'draft',
      })
      .expect(403)
  })

  // ── GET /posts (public, paginated, published only) ─────────────────────────

  it('GET /posts → 200 with paginated list of published posts only', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ limit: 10, page: 1 })
      .expect(200)

    const body = res.body as ApiResponse<Paginated<Post>>
    expect(Array.isArray(body.data.data)).toBe(true)
    expect(body.data.meta).toBeDefined()
    // Every returned post must be published — drafts are never visible publicly.
    body.data.data.forEach((post) => {
      expect(post.status).toBe('published')
    })
  })

  it('GET /posts (no query params) → 200 using defaults', async () => {
    const res = await request(app.getHttpServer()).get('/posts').expect(200)
    expect(
      Array.isArray((res.body as ApiResponse<Paginated<Post>>).data.data),
    ).toBe(true)
  })

  // ── GET /posts/:id (public) ───────────────────────────────────────────────

  it('GET /posts/:id (published post) → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/posts/${authorPublishedPostId}`)
      .expect(200)

    expect((res.body as ApiResponse<Post>).data.id).toBe(authorPublishedPostId)
  })

  it('GET /posts/:id (draft post) → 404', async () => {
    // Draft posts must be invisible to public callers — same as non-existent.
    await request(app.getHttpServer()).get(`/posts/${draftPostId}`).expect(404)
  })

  // ── GET /posts/slug/:slug (public) ────────────────────────────────────────

  it('GET /posts/slug/:slug (published post) → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/posts/slug/${authorPublishedPostSlug}`)
      .expect(200)

    expect((res.body as ApiResponse<Post>).data.slug).toBe(
      authorPublishedPostSlug,
    )
  })

  it('GET /posts/slug/:slug (draft post) → 404', async () => {
    await request(app.getHttpServer())
      .get(`/posts/slug/${draftPostSlug}`)
      .expect(404)
  })

  // ── PATCH /posts/:id ──────────────────────────────────────────────────────

  it('PATCH /posts/:id (AUTHOR) → 200 with updated post', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/posts/${authorPublishedPostId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'E2E Published Post (updated)' })
      .expect(200)

    expect((res.body as ApiResponse<Post>).data.title).toBe(
      'E2E Published Post (updated)',
    )
  })

  it('PATCH /posts/:id (EDITOR, own post) → 200', async () => {
    // EDITOR owns editorPostId (they created it), so this must succeed.
    await request(app.getHttpServer())
      .patch(`/posts/${editorPostId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'E2E Editor Post (updated)' })
      .expect(200)
  })

  it('PATCH /posts/:id (EDITOR, another author post) → 403', async () => {
    // EDITOR does not own authorPublishedPostId — ownership check must block them.
    await request(app.getHttpServer())
      .patch(`/posts/${authorPublishedPostId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'Hijacked' })
      .expect(403)
  })

  it('PATCH /posts/:id (no token) → 401', async () => {
    await request(app.getHttpServer())
      .patch(`/posts/${authorPublishedPostId}`)
      .send({ title: 'Anonymous edit' })
      .expect(401)
  })

  // ── excerpt / isFeatured / publishedAt ────────────────────────────────────

  it('POST /posts with status published → 201 with publishedAt set', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Published On Create',
        slug: 'e2e-published-on-create',
        status: 'published',
      })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.publishedAt).not.toBeNull()
    extraPostIds.push(post.id)
  })

  it('POST /posts with status draft (default) → 201 with publishedAt null', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Draft No PublishedAt',
        slug: 'e2e-draft-no-published-at',
      })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.publishedAt).toBeFalsy()
    extraPostIds.push(post.id)
  })

  it('PATCH transitioning draft → published sets publishedAt', async () => {
    expect(draftPostId).toBeDefined()

    const res = await request(app.getHttpServer())
      .patch(`/posts/${draftPostId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ status: 'published' })
      .expect(200)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.publishedAt).not.toBeNull()
  })

  it('PATCH on an already-published post with an unrelated field leaves publishedAt unchanged', async () => {
    const first = await request(app.getHttpServer())
      .patch(`/posts/${authorPublishedPostId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Touch 1' })
      .expect(200)
    const publishedAtBefore = (first.body as ApiResponse<Post>).data.publishedAt

    const second = await request(app.getHttpServer())
      .patch(`/posts/${authorPublishedPostId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Touch 2' })
      .expect(200)
    const publishedAtAfter = (second.body as ApiResponse<Post>).data.publishedAt

    expect(publishedAtAfter).toBe(publishedAtBefore)
  })

  it('PATCH /posts/:id with publishedAt in the body → 400 (server-derived only)', async () => {
    await request(app.getHttpServer())
      .patch(`/posts/${authorPublishedPostId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ publishedAt: '2024-01-01T00:00:00.000Z' })
      .expect(400)
  })

  it('POST /posts with a valid excerpt (≤160 chars) round-trips', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Excerpt Post',
        slug: 'e2e-excerpt-post',
        excerpt: 'A short summary of this post.',
      })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    expect(post.excerpt).toBe('A short summary of this post.')
    extraPostIds.push(post.id)
  })

  it('POST /posts with an excerpt over 160 chars → 400', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Excerpt Too Long',
        slug: 'e2e-excerpt-too-long',
        excerpt: 'x'.repeat(161),
      })
      .expect(400)
  })

  it('isFeatured round-trips on create and patch, defaulting to false', async () => {
    const created = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Featured Post',
        slug: 'e2e-featured-post',
      })
      .expect(201)
    const createdPost = (created.body as ApiResponse<Post>).data
    expect(createdPost.isFeatured).toBe(false)
    extraPostIds.push(createdPost.id)

    const patched = await request(app.getHttpServer())
      .patch(`/posts/${createdPost.id}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ isFeatured: true })
      .expect(200)
    expect((patched.body as ApiResponse<Post>).data.isFeatured).toBe(true)
  })

  // ── DELETE /posts/:id ─────────────────────────────────────────────────────

  it('DELETE /posts/:id (AUTHOR) → 200', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/posts/${deletePostId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200)

    expect(
      (res.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: deletePostId })
  })

  it('DELETE /posts/:id (no token) → 401', async () => {
    await request(app.getHttpServer())
      .delete(`/posts/${authorPublishedPostId}`)
      .expect(401)
  })
})
