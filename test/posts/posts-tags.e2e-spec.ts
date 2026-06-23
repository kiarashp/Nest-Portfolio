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

describe('POST|DELETE /posts/:id/tags (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let authorToken: string
  let editorToken: string
  let userToken: string

  let tagAId: number
  let tagBId: number
  let tagCId: number

  let authorPostId: number
  let editorPostId: number

  const AUTHOR_EMAIL = 'tags-author@e2e.test'
  const EDITOR_EMAIL = 'tags-editor@e2e.test'
  const USER_EMAIL = 'tags-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    // Pre-cleanup
    for (const slug of ['tags-spec-author-post', 'tags-spec-editor-post']) {
      await postRepo.delete({ slug })
    }
    for (const tagSlug of [
      'tags-spec-tag-a',
      'tags-spec-tag-b',
      'tags-spec-tag-c',
    ]) {
      await tagRepo.delete({ slug: tagSlug })
    }
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL, USER_EMAIL])

    // Seed users
    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'TagsAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: EDITOR_EMAIL,
      password: PASSWORD,
      firstName: 'TagsEditor',
      role: UserRole.EDITOR,
    })
    await seedUser(dataSource, {
      email: USER_EMAIL,
      password: PASSWORD,
      firstName: 'TagsUser',
      role: UserRole.USER,
    })

    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    editorToken = await getAuthToken(app, EDITOR_EMAIL, PASSWORD)
    userToken = await getAuthToken(app, USER_EMAIL, PASSWORD)

    // Seed tags via API
    const tagARes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Tags Spec Tag A', slug: 'tags-spec-tag-a' })
    tagAId = (tagARes.body as ApiResponse<Tag>).data.id

    const tagBRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Tags Spec Tag B', slug: 'tags-spec-tag-b' })
    tagBId = (tagBRes.body as ApiResponse<Tag>).data.id

    const tagCRes = await request(app.getHttpServer())
      .post('/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Tags Spec Tag C', slug: 'tags-spec-tag-c' })
    tagCId = (tagCRes.body as ApiResponse<Tag>).data.id

    // Seed posts — author starts with tag A, editor starts with no tags
    const authorPostRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Tags Spec Author Post',
        postType: 'post',
        slug: 'tags-spec-author-post',
        status: 'published',
        tags: [tagAId],
      })
    authorPostId = (authorPostRes.body as ApiResponse<Post>).data.id

    const editorPostRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Tags Spec Editor Post',
        postType: 'post',
        slug: 'tags-spec-editor-post',
        status: 'published',
      })
    editorPostId = (editorPostRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    const postRepo = dataSource.getRepository(Post)
    const tagRepo = dataSource.getRepository(Tag)

    const ids = [authorPostId, editorPostId].filter(Boolean)
    if (ids.length) {
      await postRepo.delete(ids)
    }
    if (tagAId) await tagRepo.delete({ id: tagAId })
    if (tagBId) await tagRepo.delete({ id: tagBId })
    if (tagCId) await tagRepo.delete({ id: tagCId })
    await cleanupUsers(dataSource, [AUTHOR_EMAIL, EDITOR_EMAIL, USER_EMAIL])
    await app.close()
  })

  // ── POST /posts/:id/tags ──────────────────────────────────────────────────

  it('POST /posts/:id/tags (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .send({ tagIds: [tagBId] })
      .expect(401)
  })

  it('POST /posts/:id/tags (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ tagIds: [tagBId] })
      .expect(403)
  })

  it('POST /posts/:id/tags (AUTHOR, own post) → 200, tag added', async () => {
    const res = await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [tagBId] })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    const tagIds = post.tags?.map((t) => t.id) ?? []
    expect(tagIds).toContain(tagAId)
    expect(tagIds).toContain(tagBId)
  })

  it('POST /posts/:id/tags (AUTHOR) adding existing tag is idempotent', async () => {
    const res = await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [tagAId] })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    const tagIds = post.tags?.map((t) => t.id) ?? []
    // tag A should appear exactly once
    expect(tagIds.filter((id) => id === tagAId)).toHaveLength(1)
  })

  it('POST /posts/:id/tags (AUTHOR) with non-existent tag ID → 400', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [999999] })
      .expect(400)
  })

  it('POST /posts/:id/tags (AUTHOR) with empty tagIds → 400', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [] })
      .expect(400)
  })

  it('POST /posts/:id/tags (EDITOR, own post) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/posts/${editorPostId}/tags`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ tagIds: [tagCId] })
      .expect(201)

    const post = (res.body as ApiResponse<Post>).data
    const tagIds = post.tags?.map((t) => t.id) ?? []
    expect(tagIds).toContain(tagCId)
  })

  it('POST /posts/:id/tags (EDITOR, another user post) → 403', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ tagIds: [tagCId] })
      .expect(403)
  })

  it('POST /posts/999/tags (non-existent post) → 404', async () => {
    await request(app.getHttpServer())
      .post('/posts/999999/tags')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [tagAId] })
      .expect(404)
  })

  // ── DELETE /posts/:id/tags ────────────────────────────────────────────────

  it('DELETE /posts/:id/tags (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .delete(`/posts/${authorPostId}/tags`)
      .send({ tagIds: [tagBId] })
      .expect(401)
  })

  it('DELETE /posts/:id/tags (USER role) → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ tagIds: [tagBId] })
      .expect(403)
  })

  it('DELETE /posts/:id/tags (EDITOR, another user post) → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ tagIds: [tagAId] })
      .expect(403)
  })

  it('DELETE /posts/:id/tags (AUTHOR, own post) → 200, tag removed', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [tagBId] })
      .expect(200)

    const post = (res.body as ApiResponse<Post>).data
    const tagIds = post.tags?.map((t) => t.id) ?? []
    expect(tagIds).not.toContain(tagBId)
    // tag A should still be there
    expect(tagIds).toContain(tagAId)
  })

  it('DELETE /posts/:id/tags removing a tag not on the post is idempotent → 200', async () => {
    // tagB was already removed above — removing again should not error
    const res = await request(app.getHttpServer())
      .delete(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [tagBId] })
      .expect(200)

    const post = (res.body as ApiResponse<Post>).data
    const tagIds = post.tags?.map((t) => t.id) ?? []
    expect(tagIds).not.toContain(tagBId)
  })

  it('DELETE /posts/:id/tags with empty tagIds → 400', async () => {
    await request(app.getHttpServer())
      .delete(`/posts/${authorPostId}/tags`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ tagIds: [] })
      .expect(400)
  })
})
