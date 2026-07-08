import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConflictException } from '@nestjs/common'
import { DeleteProductTypeProvider } from './delete-product-type.provider'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { ProductType } from '../entities/product-type.entity'
import { Product } from '../entities/product.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('DeleteProductTypeProvider', () => {
  let provider: DeleteProductTypeProvider
  let productTypesRepository: { delete: jest.Mock }
  let productsRepository: { count: jest.Mock }
  let uploadFilesRepository: { find: jest.Mock }
  let findOneProductTypeProvider: { findOneByIdOrFail: jest.Mock }
  let uploadsService: { deleteFile: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    productTypesRepository = { delete: jest.fn().mockResolvedValue(undefined) }
    productsRepository = { count: jest.fn().mockResolvedValue(0) }
    uploadFilesRepository = { find: jest.fn().mockResolvedValue([]) }
    findOneProductTypeProvider = {
      findOneByIdOrFail: jest.fn().mockResolvedValue({ id: 3 }),
    }
    uploadsService = { deleteFile: jest.fn().mockResolvedValue(undefined) }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProductTypeProvider,
        {
          provide: getRepositoryToken(ProductType),
          useValue: productTypesRepository,
        },
        { provide: getRepositoryToken(Product), useValue: productsRepository },
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

    provider = module.get(DeleteProductTypeProvider)
  })

  it('purges every tracked image before hard-deleting', async () => {
    uploadFilesRepository.find.mockResolvedValue([
      { path: 'url-1' },
      { path: 'url-2' },
    ])

    const result = await provider.delete(3, 9)

    expect(uploadFilesRepository.find).toHaveBeenCalledWith({
      where: { productTypeId: 3 },
    })
    expect(uploadsService.deleteFile).toHaveBeenCalledTimes(2)
    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-2')
    expect(productTypesRepository.delete).toHaveBeenCalledWith(3)
    expect(auditLogService.log).toHaveBeenCalledWith(
      9,
      AuditAction.DELETE,
      'ProductType',
      3,
    )
    expect(result).toEqual({ deleted: true, id: 3 })
  })

  it('deletes a type with no tracked image without calling storage', async () => {
    await provider.delete(3, 9)

    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
    expect(productTypesRepository.delete).toHaveBeenCalledWith(3)
  })

  it('throws 409 and does not purge images when products still reference the type', async () => {
    productsRepository.count.mockResolvedValue(2)

    await expect(provider.delete(3, 9)).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(uploadFilesRepository.find).not.toHaveBeenCalled()
    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
    expect(productTypesRepository.delete).not.toHaveBeenCalled()
  })
})
