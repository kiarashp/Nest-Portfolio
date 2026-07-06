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

describe('GET /posts/:id/related (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let authorToken: string

  let sharedTagId: number
  let unrelatedTagId: number

  let anchorPostId: number
  let siblingPostId: number
  let unrelatedTagPostId: number
  let untaggedPostId: number
  let draftSiblingPostId: number
  let taglessAnchorPostId: number

  const AUTHOR_EMAIL = 'posts-related-author@e2e.test'
  const PASSWORD = 'Password1!'

  const postSlugs = [
    'related-spec-anchor',
    'related-spec-sibling',
    'related-spec-unrelated-tag',
    'related-spec-untagged',
    'related-spec-draft-sibling',
    'related-spec-tagless-anchor',
  ]
  const tagSlugs = ['related-spec-shared', 'related-spec-unrelated']

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    // Pre-cleanup from a previous failed run.
    for (const slug of postSlugs) {
      await postRepo.delete({ slug })
    }
    for (const slug of tagSlugs) {
      await tagRepo.delete({ slug })
    }
    await cleanupUsers(dataSource, [AUTHOR_EMAIL])

    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'RelatedAuthor',
      role: UserRole.AUTHOR,
    })
    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)

    const sharedTagRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Related Spec Shared', slug: 'related-spec-shared' })
    sharedTagId = (sharedTagRes.body as ApiResponse<Tag>).data.id

    const unrelatedTagRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Related Spec Unrelated', slug: 'related-spec-unrelated' })
    unrelatedTagId = (unrelatedTagRes.body as ApiResponse<Tag>).data.id

    // Anchor post — published, tagged with the shared tag.
    const anchorRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Related Spec Anchor',
        slug: 'related-spec-anchor',
        status: 'published',
        tags: [sharedTagId],
      })
    anchorPostId = (anchorRes.body as ApiResponse<Post>).data.id

    // Sibling post — published, shares the tag — must appear.
    const siblingRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Related Spec Sibling',
        slug: 'related-spec-sibling',
        status: 'published',
        tags: [sharedTagId],
      })
    siblingPostId = (siblingRes.body as ApiResponse<Post>).data.id

    // Published post tagged only with an unrelated tag — must not appear.
    const unrelatedTagPostRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Related Spec Unrelated Tag Post',
        slug: 'related-spec-unrelated-tag',
        status: 'published',
        tags: [unrelatedTagId],
      })
    unrelatedTagPostId = (unrelatedTagPostRes.body as ApiResponse<Post>).data.id

    // Published post with no tags at all — must not appear.
    const untaggedRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Related Spec Untagged',
        slug: 'related-spec-untagged',
        status: 'published',
      })
    untaggedPostId = (untaggedRes.body as ApiResponse<Post>).data.id

    // Draft post sharing the tag — must not appear (status excluded).
    const draftSiblingRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Related Spec Draft Sibling',
        slug: 'related-spec-draft-sibling',
        status: 'draft',
        tags: [sharedTagId],
      })
    draftSiblingPostId = (draftSiblingRes.body as ApiResponse<Post>).data.id

    // Published, tagless anchor — used to assert the no-fallback empty-array case.
    const taglessAnchorRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Related Spec Tagless Anchor',
        slug: 'related-spec-tagless-anchor',
        status: 'published',
      })
    taglessAnchorPostId = (taglessAnchorRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    const ids = [
      anchorPostId,
      siblingPostId,
      unrelatedTagPostId,
      untaggedPostId,
      draftSiblingPostId,
      taglessAnchorPostId,
    ].filter(Boolean)
    if (ids.length) {
      await postRepo.delete(ids)
    }
    if (sharedTagId) await tagRepo.delete({ id: sharedTagId })
    if (unrelatedTagId) await tagRepo.delete({ id: unrelatedTagId })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL])
    await app.close()
  })

  // ── GET /posts/:id/related ────────────────────────────────────────────────

  it('returns the shared-tag sibling and excludes self/unrelated/untagged/draft', async () => {
    const res = await request(app.getHttpServer())
      .get(`/posts/${anchorPostId}/related`)
      .expect(200)

    const ids = (res.body as ApiResponse<Post[]>).data.map((p) => p.id)
    expect(ids).toContain(siblingPostId)
    expect(ids).not.toContain(anchorPostId)
    expect(ids).not.toContain(unrelatedTagPostId)
    expect(ids).not.toContain(untaggedPostId)
    expect(ids).not.toContain(draftSiblingPostId)
  })

  it('?limit= caps the number of results', async () => {
    const res = await request(app.getHttpServer())
      .get(`/posts/${anchorPostId}/related`)
      .query({ limit: 1 })
      .expect(200)

    expect((res.body as ApiResponse<Post[]>).data.length).toBeLessThanOrEqual(1)
  })

  it('?limit=0 → 400', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${anchorPostId}/related`)
      .query({ limit: 0 })
      .expect(400)
  })

  it('?limit=999 (over max) → 400', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${anchorPostId}/related`)
      .query({ limit: 999 })
      .expect(400)
  })

  it('non-existent anchor → 404', async () => {
    await request(app.getHttpServer()).get('/posts/999999/related').expect(404)
  })

  it('draft anchor → 404', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${draftSiblingPostId}/related`)
      .expect(404)
  })

  it('tagless published anchor → 200 with an empty array (no fallback)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/posts/${taglessAnchorPostId}/related`)
      .expect(200)

    expect((res.body as ApiResponse<Post[]>).data).toEqual([])
  })
})
