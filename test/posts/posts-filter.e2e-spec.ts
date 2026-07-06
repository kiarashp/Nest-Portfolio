import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Post } from '../../src/posts/entities/post.entity'
import { Tag } from '../../src/tags/entities/tag.entity'
import { User } from '../../src/users/entities/user.entity'
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

describe('GET /posts (filter by tag/author) (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let authorToken: string
  let editorToken: string

  let tagAId: number
  let tagBId: number

  // Post IDs tracked for cleanup
  let postTagAId: number
  let postTagABId: number
  let postTagBId: number
  let postNoTagsId: number
  let postDraftId: number
  let postFeaturedId: number

  const AUTHOR_EMAIL = 'filter-author@e2e.test'
  const EDITOR_EMAIL = 'filter-editor@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    // Pre-cleanup: remove rows left by a previous failed run.
    for (const slug of [
      'filter-post-tag-a',
      'filter-post-tag-ab',
      'filter-post-tag-b',
      'filter-post-no-tags',
      'filter-post-draft',
      'filter-post-featured',
    ]) {
      await postRepo.delete({ slug })
    }
    for (const tagSlug of ['filter-tag-a', 'filter-tag-b']) {
      await tagRepo.delete({ slug: tagSlug })
    }
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL])

    // Seed users
    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'FilterAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: EDITOR_EMAIL,
      password: PASSWORD,
      firstName: 'FilterEditor',
      role: UserRole.EDITOR,
    })

    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    editorToken = await getAuthToken(app, EDITOR_EMAIL, PASSWORD)

    // Seed tags via API
    const tagARes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Filter Tag A', slug: 'filter-tag-a' })
    tagAId = (tagARes.body as ApiResponse<Tag>).data.id

    const tagBRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Filter Tag B', slug: 'filter-tag-b' })
    tagBId = (tagBRes.body as ApiResponse<Tag>).data.id

    // Seed posts via API
    const postTagARes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Filter Post Tag A',
        slug: 'filter-post-tag-a',
        status: 'published',
        tags: [tagAId],
      })
    postTagAId = (postTagARes.body as ApiResponse<Post>).data.id

    const postTagABRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Filter Post Tag AB',
        slug: 'filter-post-tag-ab',
        status: 'published',
        tags: [tagAId, tagBId],
      })
    postTagABId = (postTagABRes.body as ApiResponse<Post>).data.id

    const postTagBRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Filter Post Tag B',
        slug: 'filter-post-tag-b',
        status: 'published',
        tags: [tagBId],
      })
    postTagBId = (postTagBRes.body as ApiResponse<Post>).data.id

    // Editor post — no tags, used to test authorId isolation
    const postNoTagsRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Filter Post No Tags',
        slug: 'filter-post-no-tags',
        status: 'published',
      })
    postNoTagsId = (postNoTagsRes.body as ApiResponse<Post>).data.id

    // Draft post — must never appear in public GET /posts results
    const postDraftRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Filter Post Draft',
        slug: 'filter-post-draft',
        status: 'draft',
        tags: [tagAId],
      })
    postDraftId = (postDraftRes.body as ApiResponse<Post>).data.id

    // Featured post — created by the editor (not the author) so it does not
    // land in the author-scoped result sets the sortBy/order tests above
    // assert exact equality against.
    const postFeaturedRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Filter Post Featured',
        slug: 'filter-post-featured',
        status: 'published',
        isFeatured: true,
      })
    postFeaturedId = (postFeaturedRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    const ids = [
      postTagAId,
      postTagABId,
      postTagBId,
      postNoTagsId,
      postDraftId,
      postFeaturedId,
    ].filter(Boolean)
    if (ids.length) {
      await postRepo.delete(ids)
    }
    if (tagAId) await tagRepo.delete({ id: tagAId })
    if (tagBId) await tagRepo.delete({ id: tagBId })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL])
    await app.close()
  })

  // ── GET /posts?tagIds[] ───────────────────────────────────────────────────

  it('GET /posts?tagIds[]=A → returns published posts with tag A, not tag-B-only or draft posts', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ tagIds: [tagAId] })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postTagAId)
    expect(ids).toContain(postTagABId)
    expect(ids).not.toContain(postTagBId)
    expect(ids).not.toContain(postDraftId)
  })

  it('GET /posts?tagIds[]=A&tagIds[]=B → returns posts with tag A OR tag B', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ tagIds: [tagAId, tagBId] })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postTagAId)
    expect(ids).toContain(postTagABId)
    expect(ids).toContain(postTagBId)
    expect(ids).not.toContain(postDraftId)
  })

  it('GET /posts?tagIds[]=nonExistent → 200 empty data array', async () => {
    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ tagIds: [999999] })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data).toHaveLength(0)
  })

  // ── GET /posts?authorId ───────────────────────────────────────────────────

  it('GET /posts?authorId=<author> → returns only the given author published posts', async () => {
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postTagAId)
    expect(ids).toContain(postTagABId)
    expect(ids).toContain(postTagBId)
    // editor's post must NOT appear
    expect(ids).not.toContain(postNoTagsId)
    // draft must NOT appear
    expect(ids).not.toContain(postDraftId)
  })

  // ── Combined filter ───────────────────────────────────────────────────────

  it('GET /posts?authorId=<author>&tagIds[]=A → intersection of author and tag filters', async () => {
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, tagIds: [tagBId] })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    // only author's posts that also have tag B
    expect(ids).toContain(postTagABId)
    expect(ids).toContain(postTagBId)
    expect(ids).not.toContain(postTagAId)
    expect(ids).not.toContain(postNoTagsId)
  })

  // ── GET /posts?startDate / endDate ───────────────────────────────────────

  it('GET /posts?startDate=<past>&endDate=<future> → seeded posts appear in range', async () => {
    // A range that brackets today should include the posts seeded in beforeAll.
    // Scoped by authorId: GET /posts now defaults to createdAt desc (newest
    // first), so an unscoped query could push these posts past page 1 once
    // other e2e suites running in parallel create newer published posts.
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, startDate, endDate })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postTagAId)
    expect(ids).toContain(postTagABId)
    expect(ids).toContain(postTagBId)
    expect(ids).not.toContain(postDraftId)
  })

  it('GET /posts?startDate=<past> (no endDate) → open-ended range includes seeded posts', async () => {
    // Scoped by authorId for the same reason as the test above.
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, startDate })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postTagAId)
    expect(ids).toContain(postTagABId)
  })

  it('GET /posts?endDate=<yesterday> → posts created today are excluded', async () => {
    // endDate strictly before today means none of the posts seeded moments ago match.
    const endDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ endDate })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).not.toContain(postTagAId)
    expect(ids).not.toContain(postTagABId)
    expect(ids).not.toContain(postTagBId)
  })

  it('GET /posts?startDate=<future> → no posts returned', async () => {
    const startDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ startDate })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    expect(paginated.data).toHaveLength(0)
  })

  it('GET /posts?startDate=<valid>&tagIds[]=A → date and tag filters combine correctly', async () => {
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ startDate, tagIds: [tagAId] })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postTagAId)
    expect(ids).toContain(postTagABId)
    expect(ids).not.toContain(postTagBId)
    expect(ids).not.toContain(postDraftId)
  })

  it('GET /posts?startDate=notADate → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .query({ startDate: 'notADate' })
      .expect(400)
  })

  // ── Validation ────────────────────────────────────────────────────────────

  it('GET /posts?tagIds=notAnInt → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .query({ tagIds: 'notAnInt' })
      .expect(400)
  })

  // ── GET /posts?sortBy / order ────────────────────────────────────────────
  // Scoped with authorId so the result set is exactly the 3 tag posts seeded
  // above, regardless of what other e2e suites concurrently write to `post`.

  it('GET /posts?authorId&sortBy=title&order=asc → alphabetical by title', async () => {
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, sortBy: 'title', order: 'asc' })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toEqual([postTagAId, postTagABId, postTagBId])
  })

  it('GET /posts?authorId&sortBy=title&order=desc → reverse alphabetical', async () => {
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, sortBy: 'title', order: 'desc' })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toEqual([postTagBId, postTagABId, postTagAId])
  })

  it('GET /posts?authorId&sortBy=createdAt&order=asc → creation order (oldest first)', async () => {
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, sortBy: 'createdAt', order: 'asc' })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toEqual([postTagAId, postTagABId, postTagBId])
  })

  it('GET /posts?authorId (no sortBy/order) → defaults to createdAt desc (newest first)', async () => {
    const userRepo = dataSource.getRepository(User)
    const author: User | null = await userRepo.findOneBy({
      email: AUTHOR_EMAIL,
    })
    const authorId = author!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)
    expect(ids).toEqual([postTagBId, postTagABId, postTagAId])
  })

  it('GET /posts?sortBy=invalidField → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .query({ sortBy: 'invalidField' })
      .expect(400)
  })

  it('GET /posts?order=invalid → 400 validation error', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .query({ order: 'invalid' })
      .expect(400)
  })

  // ── GET /posts?isFeatured ─────────────────────────────────────────────────
  // Scoped by the editor's authorId (who owns both postNoTagsId and
  // postFeaturedId) so the result set is exactly this suite's own posts.

  it('GET /posts?authorId&isFeatured=true → returns only the featured post', async () => {
    const userRepo = dataSource.getRepository(User)
    const editor: User | null = await userRepo.findOneBy({
      email: EDITOR_EMAIL,
    })
    const authorId = editor!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, isFeatured: true })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).toContain(postFeaturedId)
    expect(ids).not.toContain(postNoTagsId)
  })

  it('GET /posts?authorId&isFeatured=false → excludes the featured post', async () => {
    const userRepo = dataSource.getRepository(User)
    const editor: User | null = await userRepo.findOneBy({
      email: EDITOR_EMAIL,
    })
    const authorId = editor!.id

    const res = await request(app.getHttpServer())
      .get('/posts')
      .query({ authorId, isFeatured: false })
      .expect(200)

    const paginated = (res.body as ApiResponse<Paginated<Post>>).data
    const ids = paginated.data.map((p) => p.id)

    expect(ids).not.toContain(postFeaturedId)
    expect(ids).toContain(postNoTagsId)
  })
})
