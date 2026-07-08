import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource, Repository } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { Post } from '../../src/posts/entities/post.entity'
import { UploadFile } from '../../src/uploads/entities/upload-file.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

// Minimal JPEG buffer — starts with the SOI + APP0 JFIF magic bytes that
// the file-type package needs to detect this as image/jpeg.
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
])

describe('Posts images (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let adminToken: string
  let authorToken: string
  let editorToken: string

  let postRepo: Repository<Post>
  let uploadFileRepo: Repository<UploadFile>

  // Post authored by AUTHOR — the editor does not own it, so editor deletes 403.
  let postId: number

  // Per-call storage mocks: upload returns a unique URL each time so UploadFile
  // rows never collide on the `path` lookup; delete is a spy we can assert on.
  let uploadCounter = 0
  const storageUpload = jest.fn().mockImplementation(() => {
    uploadCounter += 1
    return Promise.resolve({
      url: `https://res.cloudinary.com/mock/image/upload/v1/posts/test-${uploadCounter}.jpg`,
      publicId: `posts/test-${uploadCounter}`,
    })
  })
  const storageDelete = jest.fn().mockResolvedValue(undefined)

  const ADMIN_EMAIL = 'posts-images-admin@e2e.test'
  const AUTHOR_EMAIL = 'posts-images-author@e2e.test'
  const EDITOR_EMAIL = 'posts-images-editor@e2e.test'
  const PASSWORD = 'Password1!'

  const POST_SLUG = 'e2e-posts-images-post'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp({
      storageMock: { upload: storageUpload, delete: storageDelete },
    }))

    postRepo = dataSource.getRepository(Post)
    uploadFileRepo = dataSource.getRepository(UploadFile)

    // Pre-cleanup: delete rows left by a previous failed run so seeds never hit
    // unique-constraint conflicts. Each post's upload_file rows go first (FK to
    // post), then the post itself (FK to users).
    const existing = await postRepo.findOne({ where: { slug: POST_SLUG } })
    if (existing) {
      await uploadFileRepo.delete({ postId: existing.id })
      await postRepo.delete({ id: existing.id })
    }
    await cleanupUsers(dataSource, [ADMIN_EMAIL, AUTHOR_EMAIL, EDITOR_EMAIL])

    // Seed three users with different roles.
    await seedUser(dataSource, {
      email: ADMIN_EMAIL,
      password: PASSWORD,
      firstName: 'PostsImagesAdmin',
      role: UserRole.ADMIN,
    })
    await seedUser(dataSource, {
      email: AUTHOR_EMAIL,
      password: PASSWORD,
      firstName: 'PostsImagesAuthor',
      role: UserRole.AUTHOR,
    })
    await seedUser(dataSource, {
      email: EDITOR_EMAIL,
      password: PASSWORD,
      firstName: 'PostsImagesEditor',
      role: UserRole.EDITOR,
    })

    adminToken = await getAuthToken(app, ADMIN_EMAIL, PASSWORD)
    authorToken = await getAuthToken(app, AUTHOR_EMAIL, PASSWORD)
    editorToken = await getAuthToken(app, EDITOR_EMAIL, PASSWORD)

    // AUTHOR creates the post all the image tests operate on.
    const createRes = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'E2E Posts Images Post',
        slug: POST_SLUG,
        status: 'published',
      })
    postId = (createRes.body as ApiResponse<Post>).data.id
  })

  afterAll(async () => {
    // Remove image rows before the post (FK), then the post, then the users.
    await uploadFileRepo.delete({ postId })
    await postRepo.delete({ id: postId })
    await cleanupUsers(dataSource, [ADMIN_EMAIL, AUTHOR_EMAIL, EDITOR_EMAIL])
    await app.close()
  })

  // ── POST /posts/:id/images ──────────────────────────────────────────────

  it('POST /posts/:id/images (ADMIN) → 201, returns an UploadFile linked to the post', async () => {
    const res = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)

    const file = (res.body as ApiResponse<UploadFile>).data
    expect(file.id).toBeDefined()
    expect(file.postId).toBe(postId)
    expect(file.path).toContain('cloudinary')
  })

  // ── GET /posts/:id/images/:fileId ───────────────────────────────────────

  it('GET /posts/:id/images/:fileId (ADMIN) → 200, returns the file', async () => {
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'single.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    const res = await request(app.getHttpServer())
      .get(`/posts/${postId}/images/${file.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect((res.body as ApiResponse<UploadFile>).data.id).toBe(file.id)
  })

  it('GET /posts/:id/images/:fileId for a non-existent file → 404', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${postId}/images/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  it('GET /posts/:id/images/:fileId (EDITOR on a post they do not own) → 403', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${postId}/images/999999`)
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(403)
  })

  // ── DELETE /posts/:id/images/:fileId ────────────────────────────────────

  it('DELETE /posts/:id/images/:fileId (ADMIN) → 200, removes the file and clears featuredImage', async () => {
    // Upload an image, then point the post's featuredImage at it.
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'featured.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ featuredImage: file.path })
      .expect(200)

    storageDelete.mockClear()

    const delRes = await request(app.getHttpServer())
      .delete(`/posts/${postId}/images/${file.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (delRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: file.id })

    // The Cloudinary asset was deleted and the upload_file row is gone.
    expect(storageDelete).toHaveBeenCalledWith(file.publicId)
    const row: UploadFile | null = await uploadFileRepo.findOneBy({
      id: file.id,
    })
    expect(row).toBeNull()

    // The featuredImage was cleared since it pointed at the deleted file.
    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.featuredImage).toBeNull()
  })

  it('DELETE /posts/:id/images/:fileId (ADMIN) → 200, removes the file and clears it from the images gallery', async () => {
    // Upload two images, then curate a gallery containing both.
    const upRes1 = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'gallery-1.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file1 = (upRes1.body as ApiResponse<UploadFile>).data

    const upRes2 = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'gallery-2.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file2 = (upRes2.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [file1.path, file2.path] })
      .expect(200)

    const delRes = await request(app.getHttpServer())
      .delete(`/posts/${postId}/images/${file1.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(
      (delRes.body as ApiResponse<{ deleted: boolean; id: number }>).data,
    ).toEqual({ deleted: true, id: file1.id })

    // Only the deleted file's URL is removed from the gallery — the other stays.
    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.images).toEqual([file2.path])
  })

  // ── PATCH /posts/:id (featuredImage clear) ──────────────────────────────

  it('PATCH /posts/:id with featuredImage: null clears an existing featured image', async () => {
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'to-clear.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ featuredImage: file.path })
      .expect(200)

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ featuredImage: null })
      .expect(200)

    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.featuredImage).toBeNull()
  })

  it('PATCH /posts/:id with featuredImage: "" → 400 (not a valid clear signal)', async () => {
    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ featuredImage: '' })
      .expect(400)
  })

  it('PATCH /posts/:id with featuredImage omitted leaves the existing value untouched', async () => {
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'untouched.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ featuredImage: file.path })
      .expect(200)

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Untouched featured image title' })
      .expect(200)

    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.featuredImage).toBe(file.path)
  })

  // ── PATCH /posts/:id (images gallery) ────────────────────────────────────

  it('PATCH /posts/:id with images sets the curated gallery subset', async () => {
    const upRes1 = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'set-gallery-1.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file1 = (upRes1.body as ApiResponse<UploadFile>).data

    const upRes2 = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'set-gallery-2.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file2 = (upRes2.body as ApiResponse<UploadFile>).data

    const patchRes = await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [file1.path, file2.path] })
      .expect(200)

    expect((patchRes.body as ApiResponse<Post>).data.images).toEqual([
      file1.path,
      file2.path,
    ])

    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.images).toEqual([file1.path, file2.path])
  })

  it('PATCH /posts/:id with images: null clears an existing gallery', async () => {
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'clear-gallery.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [file.path] })
      .expect(200)

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: null })
      .expect(200)

    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.images).toBeNull()
  })

  it('PATCH /posts/:id with images omitted leaves the existing gallery untouched', async () => {
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'untouched-gallery.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [file.path] })
      .expect(200)

    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Untouched gallery title' })
      .expect(200)

    const post: Post | null = await postRepo.findOneBy({ id: postId })
    expect(post!.images).toEqual([file.path])
  })

  it('DELETE /posts/:id/images/:fileId for a non-existent file → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/posts/${postId}/images/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
  })

  it('DELETE /posts/:id/images/:fileId (EDITOR on a post they do not own) → 403', async () => {
    // Upload an image as the author so there is a real file to target.
    const upRes = await request(app.getHttpServer())
      .post(`/posts/${postId}/images`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', JPEG_MAGIC, {
        filename: 'editor-forbidden.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201)
    const file = (upRes.body as ApiResponse<UploadFile>).data

    storageDelete.mockClear()

    // The editor did not author this post, so the delete is forbidden and the
    // file is left untouched.
    await request(app.getHttpServer())
      .delete(`/posts/${postId}/images/${file.id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(403)

    expect(storageDelete).not.toHaveBeenCalled()
    const row: UploadFile | null = await uploadFileRepo.findOneBy({
      id: file.id,
    })
    expect(row).not.toBeNull()
  })
})
