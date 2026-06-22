import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { StorageProvider } from 'src/uploads/providers/storage.provider'
import { AvatarOption } from '../entities/avatar-option.entity'
import { AvatarOptionsProvider } from './avatar-options.provider'

const mockOption: AvatarOption = {
  id: 1,
  url: 'https://res.cloudinary.com/test/avatar-1.jpg',
  publicId: 'avatars/avatar-1',
  createdAt: new Date(),
}

describe('AvatarOptionsProvider', () => {
  let provider: AvatarOptionsProvider
  let deleteMock: jest.Mock

  beforeEach(async () => {
    deleteMock = jest.fn().mockResolvedValue(undefined)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarOptionsProvider,
        {
          provide: getRepositoryToken(AvatarOption),
          useValue: {
            find: jest.fn().mockResolvedValue([mockOption]),
            findOne: jest.fn().mockResolvedValue(mockOption),
            save: jest.fn().mockResolvedValue(mockOption),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: StorageProvider,
          useValue: {
            upload: jest.fn().mockResolvedValue({
              url: mockOption.url,
              publicId: mockOption.publicId,
            }),
            delete: deleteMock,
          },
        },
      ],
    }).compile()

    provider = module.get<AvatarOptionsProvider>(AvatarOptionsProvider)
  })

  describe('remove()', () => {
    it('calls storageProvider.delete() with the correct publicId', async () => {
      await provider.remove(mockOption.id)
      expect(deleteMock).toHaveBeenCalledTimes(1)
      expect(deleteMock).toHaveBeenCalledWith(mockOption.publicId)
    })

    it('throws NotFoundException when the option does not exist', async () => {
      const repo = {
        findOne: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
      }
      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          AvatarOptionsProvider,
          { provide: getRepositoryToken(AvatarOption), useValue: repo },
          {
            provide: StorageProvider,
            useValue: { upload: jest.fn(), delete: deleteMock },
          },
        ],
      }).compile()

      const p = moduleRef.get<AvatarOptionsProvider>(AvatarOptionsProvider)
      await expect(p.remove(999)).rejects.toThrow(NotFoundException)
      expect(deleteMock).not.toHaveBeenCalled()
    })
  })
})
