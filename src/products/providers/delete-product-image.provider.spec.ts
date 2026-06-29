import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { DeleteProductImageProvider } from './delete-product-image.provider'
import { FindOneProductProvider } from './find-one-product.provider'
import { Product } from '../entities/product.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('DeleteProductImageProvider', () => {
  let provider: DeleteProductImageProvider
  let productsRepository: { save: jest.Mock }
  let uploadFilesRepository: { findOneBy: jest.Mock }
  let findOneProductProvider: { findOneByIdOrFail: jest.Mock }
  let uploadsService: { deleteFile: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    productsRepository = { save: jest.fn().mockResolvedValue(undefined) }
    uploadFilesRepository = { findOneBy: jest.fn() }
    findOneProductProvider = { findOneByIdOrFail: jest.fn() }
    uploadsService = { deleteFile: jest.fn().mockResolvedValue(undefined) }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProductImageProvider,
        { provide: getRepositoryToken(Product), useValue: productsRepository },
        {
          provide: getRepositoryToken(UploadFile),
          useValue: uploadFilesRepository,
        },
        { provide: FindOneProductProvider, useValue: findOneProductProvider },
        { provide: UploadsService, useValue: uploadsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(DeleteProductImageProvider)
  })

  it('deletes the file and clears it from imageUrl and the images gallery', async () => {
    const product = {
      id: 5,
      imageUrl: 'url-1',
      images: ['url-1', 'url-2'],
    }
    findOneProductProvider.findOneByIdOrFail.mockResolvedValue(product)
    uploadFilesRepository.findOneBy.mockResolvedValue({
      id: 3,
      productId: 5,
      path: 'url-1',
    })

    const result = await provider.deleteImage(5, 3, 9)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(product.imageUrl).toBeNull()
    expect(product.images).toEqual(['url-2'])
    expect(productsRepository.save).toHaveBeenCalledWith(product)
    expect(auditLogService.log).toHaveBeenCalledWith(
      9,
      AuditAction.UPDATE,
      'Product',
      5,
    )
    expect(result).toEqual({ deleted: true, id: 3 })
  })

  it('does not save the product when the deleted image was not referenced', async () => {
    const product = { id: 5, imageUrl: 'other', images: ['other'] }
    findOneProductProvider.findOneByIdOrFail.mockResolvedValue(product)
    uploadFilesRepository.findOneBy.mockResolvedValue({
      id: 3,
      productId: 5,
      path: 'url-1',
    })

    await provider.deleteImage(5, 3, 9)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(productsRepository.save).not.toHaveBeenCalled()
  })

  it('throws 404 when the file belongs to a different product', async () => {
    findOneProductProvider.findOneByIdOrFail.mockResolvedValue({ id: 5 })
    uploadFilesRepository.findOneBy.mockResolvedValue({
      id: 3,
      productId: 99,
      path: 'url-1',
    })

    await expect(provider.deleteImage(5, 3, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
  })

  it('throws 404 when the file does not exist', async () => {
    findOneProductProvider.findOneByIdOrFail.mockResolvedValue({ id: 5 })
    uploadFilesRepository.findOneBy.mockResolvedValue(null)

    await expect(provider.deleteImage(5, 3, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
