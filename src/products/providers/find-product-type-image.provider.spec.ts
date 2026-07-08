import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { FindProductTypeImageProvider } from './find-product-type-image.provider'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'

describe('FindProductTypeImageProvider', () => {
  let provider: FindProductTypeImageProvider
  let uploadFilesRepository: { findOne: jest.Mock }
  let findOneProductTypeProvider: { findOneByIdOrFail: jest.Mock }

  beforeEach(async () => {
    uploadFilesRepository = { findOne: jest.fn() }
    findOneProductTypeProvider = {
      findOneByIdOrFail: jest.fn().mockResolvedValue({ id: 3 }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindProductTypeImageProvider,
        {
          provide: getRepositoryToken(UploadFile),
          useValue: uploadFilesRepository,
        },
        {
          provide: FindOneProductTypeProvider,
          useValue: findOneProductTypeProvider,
        },
      ],
    }).compile()

    provider = module.get(FindProductTypeImageProvider)
  })

  it('returns the tracked image', async () => {
    const file = { id: 5, productTypeId: 3, path: 'url-1' }
    uploadFilesRepository.findOne.mockResolvedValue(file)

    const result = await provider.findProductTypeImage(3)

    expect(uploadFilesRepository.findOne).toHaveBeenCalledWith({
      where: { productTypeId: 3 },
    })
    expect(result).toBe(file)
  })

  it('throws 404 when no image is tracked', async () => {
    uploadFilesRepository.findOne.mockResolvedValue(null)

    await expect(provider.findProductTypeImage(3)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
