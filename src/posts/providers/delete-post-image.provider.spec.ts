import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DeletePostImageProvider } from './delete-post-image.provider'
import { FindOnePostProvider } from './find-one-post.provider'
import { Post } from '../entities/post.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

const adminUser: ActiveUserData = {
  sub: 9,
  email: 'admin@test.dev',
  role: UserRole.ADMIN,
}

describe('DeletePostImageProvider', () => {
  let provider: DeletePostImageProvider
  let postsRepository: { save: jest.Mock }
  let uploadFilesRepository: { findOneBy: jest.Mock }
  let findOnePostProvider: { findOneByIdOrFail: jest.Mock }
  let uploadsService: { deleteFile: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    postsRepository = { save: jest.fn().mockResolvedValue(undefined) }
    uploadFilesRepository = { findOneBy: jest.fn() }
    findOnePostProvider = { findOneByIdOrFail: jest.fn() }
    uploadsService = { deleteFile: jest.fn().mockResolvedValue(undefined) }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletePostImageProvider,
        { provide: getRepositoryToken(Post), useValue: postsRepository },
        {
          provide: getRepositoryToken(UploadFile),
          useValue: uploadFilesRepository,
        },
        { provide: FindOnePostProvider, useValue: findOnePostProvider },
        { provide: UploadsService, useValue: uploadsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(DeletePostImageProvider)
  })

  it('deletes the file and clears featuredImage when it pointed at the deleted image', async () => {
    const post = { id: 6, author: { id: 1 }, featuredImage: 'url-1' }
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(post)
    uploadFilesRepository.findOneBy.mockResolvedValue({
      id: 3,
      postId: 6,
      path: 'url-1',
    })

    const result = await provider.deletePostImage(6, 3, adminUser)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(post.featuredImage).toBeNull()
    expect(postsRepository.save).toHaveBeenCalledWith(post)
    expect(auditLogService.log).toHaveBeenCalledWith(
      9,
      AuditAction.UPDATE,
      'Post',
      6,
    )
    expect(result).toEqual({ deleted: true, id: 3 })
  })

  it('does not save the post when the deleted image was not the featuredImage', async () => {
    const post = { id: 6, author: { id: 1 }, featuredImage: 'other' }
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue(post)
    uploadFilesRepository.findOneBy.mockResolvedValue({
      id: 3,
      postId: 6,
      path: 'url-1',
    })

    await provider.deletePostImage(6, 3, adminUser)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(postsRepository.save).not.toHaveBeenCalled()
  })

  it('throws 404 when the file belongs to a different post', async () => {
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue({
      id: 6,
      author: { id: 1 },
    })
    uploadFilesRepository.findOneBy.mockResolvedValue({
      id: 3,
      postId: 99,
      path: 'url-1',
    })

    await expect(
      provider.deletePostImage(6, 3, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
  })

  it('throws 404 when the file does not exist', async () => {
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue({
      id: 6,
      author: { id: 1 },
    })
    uploadFilesRepository.findOneBy.mockResolvedValue(null)

    await expect(
      provider.deletePostImage(6, 3, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('throws 403 when an editor targets a post they did not author', async () => {
    const editorUser: ActiveUserData = {
      sub: 2,
      email: 'editor@test.dev',
      role: UserRole.EDITOR,
    }
    findOnePostProvider.findOneByIdOrFail.mockResolvedValue({
      id: 6,
      author: { id: 1 },
      featuredImage: 'url-1',
    })

    await expect(
      provider.deletePostImage(6, 3, editorUser),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(uploadFilesRepository.findOneBy).not.toHaveBeenCalled()
    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
  })
})
