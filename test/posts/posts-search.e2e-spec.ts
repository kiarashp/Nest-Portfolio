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

// Distinctive terms that will not appear in any other spec's post data.
const TITLE_TERM = 'SrchTitleTrm9Xv'
const CONTENT_TERM = 'SrchContentTrm7Wq'

describe('GET /posts (keyword search) (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let authorToken: string

  let tagId: number
  let titlePostId: number // published — TITLE_TERM in title only
  let contentPostId: number // published — CONTENT_TERM in content only
  let taggedPostId: number // published — TITLE_TERM in title + has tag
  let draftPostId: number // draft — TITLE_TERM in title, must never appear publicly

  const AUTHOR_EMAIL = 'search-author@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    // Pre-cleanup: remove rows left by a previous failed run.
    for (const slug of [
      'search-e2e-title',
      'search-e2e-content',
      'search-e2e-tagged',
      'search-e2e-draft',
    ]) {
      await postRepo.delete({ slug })
    }
    await tagRepo.delete({ slug: 'search-e2e-tag' })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL])

    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'SearchAuthor',
      role: UserRole.AUTHOR,
    })
    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)

    // Tag used for the combined q+tagIds test
    const tagRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Search E2E Tag', slug: 'search-e2e-tag' })
    tagId = (tagRes.body as ApiResponse<Tag>).data.id

    // Post 1: TITLE_TERM in title, no content
    const titleRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: `Post with ${TITLE_TERM} in title`,
        slug: 'search-e2e-title',
        status: 'published',
      })
    titlePostId = (titleRes.body as ApiResponse<Post>).data.id

    // Post 2: CONTENT_TERM in content, neutral title
    const contentRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Search E2E Content Post',
        slug: 'search-e2e-content',
        status: 'published',
        content: `This post has ${CONTENT_TERM} in its body`,
      })
    contentPostId = (contentRes.body as ApiResponse<Post>).data.id

    // Post 3: TITLE_TERM in title + has tag — used for q+tagIds combination test
    const taggedRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: `Tagged post with ${TITLE_TERM}`,
        slug: 'search-e2e-tagged',
        status: 'published',
        tags: [tagId],
      })
    taggedPostId = (taggedRes.body as ApiResponse<Post>).data.id

    // Post 4: TITLE_TERM in title, draft — must never surface on public GET /posts
    const draftRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: `Draft with ${TITLE_TERM}`,
        slug: 'search-e2e-draft',
        status: 'draft',
      })
    draftPostId = (draftRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    const ids = [titlePostId, contentPostId, taggedPostId, draftPostId].filter(
      Boolean,
    )
    if (ids.length) await postRepo.delete(ids)
    if (tagId) await tagRepo.delete({ id: tagId })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL])
    await app.close()
  })

  // ── Title match ───────────────────────────────────────────────────────────

  it('?q=<term> → matches posts with that term in their title', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: TITLE_TERM })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(titlePostId)
    expect(ids).toContain(taggedPostId)
    expect(ids).not.toContain(contentPostId)
    expect(ids).not.toContain(draftPostId)
  })

  // ── Content match ─────────────────────────────────────────────────────────

  it('?q=<term> → matches posts with that term in their content body', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: CONTENT_TERM })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(contentPostId)
    expect(ids).not.toContain(titlePostId)
    expect(ids).not.toContain(draftPostId)
  })

  // ── Case insensitive ──────────────────────────────────────────────────────

  it('?q=<lowercase term> → ILIKE matches regardless of case', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: TITLE_TERM.toLowerCase() })
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Post>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).toContain(titlePostId)
  })

  // ── No match ──────────────────────────────────────────────────────────────

  it('?q=<term with no match> → 200 with empty data array', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: 'zzz_no_match_9xq99999' })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data).toHaveLength(0)
  })

  // ── Combined: q + tagIds ──────────────────────────────────────────────────

  it('?q=<term>&tagIds=<id> → only posts matching both keyword and tag', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: TITLE_TERM, tagIds: [tagId] })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    // taggedPost has TITLE_TERM in title AND the tag; titlePost has the term but no tag
    expect(ids).toContain(taggedPostId)
    expect(ids).not.toContain(titlePostId)
    expect(ids).not.toContain(draftPostId)
  })

  // ── Drafts are never returned ─────────────────────────────────────────────

  it('draft posts with a matching title never appear even when q matches', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ q: TITLE_TERM })
      .expect(200)

    const ids = (res.body as ApiResponse<Paginated<Post>>).data.data.map(
      (p) => p.id,
    )
    expect(ids).not.toContain(draftPostId)
  })

  // ── Validation ────────────────────────────────────────────────────────────

  it('?q= (empty string) → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .query({ q: '' })
      .expect(400)
  })

  it('?q=<101 chars> → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .query({ q: 'a'.repeat(101) })
      .expect(400)
  })
})
