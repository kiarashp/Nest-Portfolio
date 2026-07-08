import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UpdatePostProvider } from './update-post.provider'
import { Post } from '../entities/post.entity'
import { TagsService } from 'src/tags/providers/tags.service'
import { FindOnePostProvider } from './find-one-post.provider'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { PostStatus } from '../enums/postStatus.enum'

// UpdatePostProvider handles the PATCH /posts/:id endpoint.
// Key business rule: EDITORs may only update posts they authored.
//                   AUTHORs and ADMINs can update any post.
// Tags are validated before the post is even fetched, so a tag mismatch
// aborts early without a database read for the post itself.
describe('UpdatePostProvider', () => {
  let provider: UpdatePostProvider
  let postsRepo: { save: jest.Mock }
  let tagsService: { findMany: jest.Mock }
  let findOnePostProvider: { findOneByIdOrFail: jest.Mock }

  // Two active users with different roles used across multiple test cases.
  const editor: ActiveUserData = {
    sub: 1,
    email: 'editor@example.com',
    role: UserRole.EDITOR,
  }
  const author: ActiveUserData = {
    sub: 2,
    email: 'author@example.com',
    role: UserRole.AUTHOR,
  }

  // A post whose author.id matches the editor's sub — the EDITOR owns this one.
  const ownedPost = {
    id: 10,
    title: 'Old Title',
    author: { id: 1 }, // same as editor.sub
    tags: [],
  } as unknown as Post

  // A post authored by someone else — the EDITOR must be rejected for this one.
  const foreignPost = {
    id: 11,
    title: 'Other Post',
    author: { id: 999 },
    tags: [],
  } as unknown as Post

  beforeEach(async () => {
    postsRepo = { save: jest.fn() }
    tagsService = { findMany: jest.fn() }
    findOnePostProvider = { findOneByIdOrFail: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePostProvider,
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: TagsService, useValue: tagsService },
        { provide: FindOnePostProvider, useValue: findOnePostProvider },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile()

    provider = module.get(UpdatePostProvider)
  })

  it('throws BadRequestException when resolved tags count does not match requested IDs', async () => {
    // The client sent [1, 2] but only tag 1 exists in the DB.
    // We reject early instead of silently dropping the missing tag.
    tagsService.findMany.mockResolvedValue([{ id: 1 }])

    await expect(provider.update(10, { tags: [1, 2] }, editor)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('throws NotFoundException when the post does not exist', async () => {
    // findOneByIdOrFail propagates a 404 — no post means no update.
    findOnePostProvider.findOneByIdOrFail.mockRejectedValue(
      new NotFoundException(),
    )

    await expect(provider.update(99, {}, editor)).rejects.toThrow(
      NotFoundException,
    )
  })

  it('throws ForbiddenException when an EDITOR tries to update a post they did not author', async () => {
    // Ownership check: EDITOR's sub (1) != foreignPost.author.id (999) → blocked.
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(foreignPost)

    await expect(
      provider.update(11, { title: 'Hijacked' }, editor),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws RequestTimeoutException when the repository save fails', async () => {
    // The post was found and ownership is fine, but the DB write fails.
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(ownedPost)
    postsRepo.save.mockRejectedValue(new Error('db error'))

    await expect(
      provider.update(10, { title: 'New Title' }, editor),
    ).rejects.toThrow(RequestTimeoutException)
  })

  it('applies the patch and returns the saved post when EDITOR owns it', async () => {
    // Happy path for EDITOR: author.id (1) === editor.sub (1) → ownership passes.
    const updatedPost = { ...ownedPost, title: 'New Title' }
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue({ ...ownedPost })
    postsRepo.save.mockResolvedValue(updatedPost)

    const result = await provider.update(10, { title: 'New Title' }, editor)

    expect(postsRepo.save).toHaveBeenCalled()
    expect(result.title).toBe('New Title')
  })

  it('skips the ownership check for AUTHOR role and saves the post', async () => {
    // AUTHORs can edit any post regardless of who wrote it — no ownership check.
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue({ ...foreignPost })
    postsRepo.save.mockResolvedValue(foreignPost)

    await expect(
      provider.update(11, { title: 'Allowed' }, author),
    ).resolves.toBeDefined()

    expect(postsRepo.save).toHaveBeenCalled()
  })

  it('stamps publishedAt when status transitions from DRAFT to PUBLISHED', async () => {
    const draftPost = {
      ...ownedPost,
      status: PostStatus.DRAFT,
      publishedAt: undefined,
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(draftPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(
      10,
      { status: PostStatus.PUBLISHED },
      author,
    )

    expect(result.publishedAt).toBeInstanceOf(Date)
  })

  it('does not re-stamp publishedAt when status stays PUBLISHED across an unrelated edit', async () => {
    const existingDate = new Date('2024-01-01T00:00:00.000Z')
    const publishedPost = {
      ...ownedPost,
      status: PostStatus.PUBLISHED,
      publishedAt: existingDate,
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(publishedPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(10, { title: 'New Title' }, author)

    expect(result.publishedAt).toBe(existingDate)
  })

  it('does not stamp publishedAt for a transition between two non-PUBLISHED statuses', async () => {
    const draftPost = {
      ...ownedPost,
      status: PostStatus.DRAFT,
      publishedAt: undefined,
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(draftPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(
      10,
      { status: PostStatus.REVIEW },
      author,
    )

    expect(result.publishedAt).toBeUndefined()
  })

  it('re-renders contentHtml when content is explicitly sent', async () => {
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue({ ...ownedPost })
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(10, { content: '# Heading' }, editor)

    expect(result.content).toBe('# Heading')
    expect(result.contentHtml).toContain('<h1>')
  })

  it('leaves content and contentHtml untouched when content is omitted', async () => {
    const existingPost = {
      ...ownedPost,
      content: 'Existing content',
      contentHtml: '<p>Existing content</p>',
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(existingPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(10, { title: 'New Title' }, editor)

    expect(result.content).toBe('Existing content')
    expect(result.contentHtml).toBe('<p>Existing content</p>')
  })

  it('replaces the images gallery when images is sent', async () => {
    const existingPost = {
      ...ownedPost,
      images: ['url-1'],
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(existingPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(
      10,
      { images: ['url-2', 'url-3'] },
      editor,
    )

    expect(result.images).toEqual(['url-2', 'url-3'])
  })

  it('clears the images gallery when images is explicitly sent as null', async () => {
    const existingPost = {
      ...ownedPost,
      images: ['url-1'],
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(existingPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(10, { images: null }, editor)

    expect(result.images).toBeNull()
  })

  it('leaves the images gallery untouched when images is omitted', async () => {
    const existingPost = {
      ...ownedPost,
      images: ['url-1'],
    } as unknown as Post
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(existingPost)
    postsRepo.save.mockImplementation((post: Post) => Promise.resolve(post))

    const result = await provider.update(10, { title: 'New Title' }, editor)

    expect(result.images).toEqual(['url-1'])
  })
})
