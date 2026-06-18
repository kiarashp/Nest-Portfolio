import { NotFoundException, RequestTimeoutException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { FindOnePostProvider } from './find-one-post.provider'
import { Post } from '../entities/post.entity'
import { PostStatus } from '../enums/postStatus.enum'

// FindOnePostProvider is the single place that reads a post from the database.
// It exposes three methods with different "missing post" behaviour:
//   findOneById          — returns null if not found (caller decides what to do)
//   findOneByIdOrFail    — throws NotFoundException if not found
//   findOnePublishedByIdOrFail — only returns posts with status=published
describe('FindOnePostProvider', () => {
  let provider: FindOnePostProvider
  // We only need the two repo methods that this provider actually calls.
  let postsRepo: { findOneBy: jest.Mock; findOne: jest.Mock }

  // A published post used as the happy-path return value.
  const publishedPost = {
    id: 1,
    title: 'Hello World',
    status: PostStatus.PUBLISHED,
  } as Post

  beforeEach(async () => {
    postsRepo = { findOneBy: jest.fn(), findOne: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindOnePostProvider,
        { provide: getRepositoryToken(Post), useValue: postsRepo },
      ],
    }).compile()

    provider = module.get(FindOnePostProvider)
  })

  // ── findOneById ───────────────────────────────────────────────────────────

  describe('findOneById', () => {
    it('returns the post when found', async () => {
      postsRepo.findOneBy.mockResolvedValue(publishedPost)
      expect(await provider.findOneById(1)).toEqual(publishedPost)
    })

    it('returns null when no post matches the id', async () => {
      // Returning null (not throwing) lets callers decide whether a missing
      // post is an error — e.g. "does this slug exist before I create it?"
      postsRepo.findOneBy.mockResolvedValue(null)
      expect(await provider.findOneById(999)).toBeNull()
    })

    it('throws RequestTimeoutException on a database error', async () => {
      // Any unexpected DB error is surfaced as a 408 so the client can retry.
      postsRepo.findOneBy.mockRejectedValue(new Error('connection lost'))
      await expect(provider.findOneById(1)).rejects.toThrow(
        RequestTimeoutException,
      )
    })
  })

  // ── findOneByIdOrFail ─────────────────────────────────────────────────────

  describe('findOneByIdOrFail', () => {
    it('returns the post when found', async () => {
      postsRepo.findOneBy.mockResolvedValue(publishedPost)
      expect(await provider.findOneByIdOrFail(1)).toEqual(publishedPost)
    })

    it('throws NotFoundException when the post does not exist', async () => {
      // Used by update/delete providers — a missing post must always be a 404.
      postsRepo.findOneBy.mockResolvedValue(null)
      await expect(provider.findOneByIdOrFail(99)).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── findOnePublishedByIdOrFail ────────────────────────────────────────────

  describe('findOnePublishedByIdOrFail', () => {
    it('returns the post when it is published', async () => {
      postsRepo.findOne.mockResolvedValue(publishedPost)
      expect(await provider.findOnePublishedByIdOrFail(1)).toEqual(
        publishedPost,
      )
      // The repo must filter by PUBLISHED status so drafts are never returned.
      expect(postsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, status: PostStatus.PUBLISHED },
      })
    })

    it('throws NotFoundException when the post is a draft (not published)', async () => {
      // findOne returns null when the post exists but is a draft — the caller
      // gets a 404, making drafts indistinguishable from non-existent posts.
      postsRepo.findOne.mockResolvedValue(null)
      await expect(provider.findOnePublishedByIdOrFail(1)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws RequestTimeoutException on a database error', async () => {
      postsRepo.findOne.mockRejectedValue(new Error('connection lost'))
      await expect(provider.findOnePublishedByIdOrFail(1)).rejects.toThrow(
        RequestTimeoutException,
      )
    })
  })
})
