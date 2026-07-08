import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { DeleteProductTypeImageProvider } from './delete-product-type-image.provider'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { ProductType } from '../entities/product-type.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('DeleteProductTypeImageProvider', () => {
  let provider: DeleteProductTypeImageProvider
  let productTypesRepository: { save: jest.Mock }
  let uploadFilesRepository: { findOne: jest.Mock }
  let findOneProductTypeProvider: { findOneByIdOrFail: jest.Mock }
  let uploadsService: { deleteFile: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    productTypesRepository = { save: jest.fn().mockResolvedValue(undefined) }
    uploadFilesRepository = { findOne: jest.fn() }
    findOneProductTypeProvider = { findOneByIdOrFail: jest.fn() }
    uploadsService = { deleteFile: jest.fn().mockResolvedValue(undefined) }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProductTypeImageProvider,
        {
          provide: getRepositoryToken(ProductType),
          useValue: productTypesRepository,
        },
        {
          provide: getRepositoryToken(UploadFile),
          useValue: uploadFilesRepository,
        },
        {
          provide: FindOneProductTypeProvider,
          useValue: findOneProductTypeProvider,
        },
        { provide: UploadsService, useValue: uploadsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile()

    provider = module.get(DeleteProductTypeImageProvider)
  })

  it('deletes the file and clears imageUrl when it points at the deleted file', async () => {
    const productType = { id: 3, imageUrl: 'url-1' }
    findOneProductTypeProvider.findOneByIdOrFail.mockResolvedValue(productType)
    uploadFilesRepository.findOne.mockResolvedValue({
      id: 5,
      productTypeId: 3,
      path: 'url-1',
    })

    const result = await provider.deleteImage(3, 9)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(productType.imageUrl).toBeNull()
    expect(productTypesRepository.save).toHaveBeenCalledWith(productType)
    expect(auditLogService.log).toHaveBeenCalledWith(
      9,
      AuditAction.UPDATE,
      'ProductType',
      3,
    )
    expect(result).toBe(productType)
  })

  it('does not save when imageUrl no longer points at the deleted file', async () => {
    const productType = { id: 3, imageUrl: 'other-url' }
    findOneProductTypeProvider.findOneByIdOrFail.mockResolvedValue(productType)
    uploadFilesRepository.findOne.mockResolvedValue({
      id: 5,
      productTypeId: 3,
      path: 'url-1',
    })

    await provider.deleteImage(3, 9)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(productTypesRepository.save).not.toHaveBeenCalled()
  })

  it('throws 404 when no image is tracked', async () => {
    findOneProductTypeProvider.findOneByIdOrFail.mockResolvedValue({ id: 3 })
    uploadFilesRepository.findOne.mockResolvedValue(null)

    await expect(provider.deleteImage(3, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
  })
})
