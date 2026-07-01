import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { FindOnePostForEditProvider } from './find-one-post-for-edit.provider'
import { FindOnePostProvider } from './find-one-post.provider'
import { Post } from '../entities/post.entity'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

// FindOnePostForEditProvider backs GET /posts/:id/admin — the staff edit-form
// fetch that, unlike GET /posts/:id, is not restricted to published posts.
// Key business rule: EDITORs may only fetch posts they authored.
//                   AUTHORs and ADMINs can fetch any post.
describe('FindOnePostForEditProvider', () => {
  let provider: FindOnePostForEditProvider
  let findOnePostProvider: { findOneByIdOrFail: jest.Mock }

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

  // A draft post whose author.id matches the editor's sub — the EDITOR owns this one.
  const ownedDraftPost = {
    id: 10,
    title: 'Draft Title',
    status: 'draft',
    author: { id: 1 }, // same as editor.sub
  } as unknown as Post

  // A draft post authored by someone else — the EDITOR must be rejected for this one.
  const foreignDraftPost = {
    id: 11,
    title: 'Other Draft',
    status: 'draft',
    author: { id: 999 },
  } as unknown as Post

  beforeEach(async () => {
    findOnePostProvider = { findOneByIdOrFail: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindOnePostForEditProvider,
        { provide: FindOnePostProvider, useValue: findOnePostProvider },
      ],
    }).compile()

    provider = module.get(FindOnePostForEditProvider)
  })

  it('throws NotFoundException when the post does not exist', async () => {
    findOnePostProvider.findOneByIdOrFail.mockRejectedValue(
      new NotFoundException(),
    )

    await expect(provider.findOneForEdit(99, editor)).rejects.toThrow(
      NotFoundException,
    )
  })

  it('throws ForbiddenException when an EDITOR fetches a draft they did not author', async () => {
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(foreignDraftPost)

    await expect(provider.findOneForEdit(11, editor)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('returns the draft post when the EDITOR owns it', async () => {
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(ownedDraftPost)

    const result = await provider.findOneForEdit(10, editor)

    expect(result).toEqual(ownedDraftPost)
  })

  it('skips the ownership check for AUTHOR role and returns any post', async () => {
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(foreignDraftPost)

    const result = await provider.findOneForEdit(11, author)

    expect(result).toEqual(foreignDraftPost)
  })
})
