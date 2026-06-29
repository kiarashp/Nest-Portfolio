import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DeleteProductProvider } from './delete-product.provider'
import { FindOneProductProvider } from './find-one-product.provider'
import { Product } from '../entities/product.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('DeleteProductProvider', () => {
  let provider: DeleteProductProvider
  let productsRepository: { softDelete: jest.Mock }
  let uploadFilesRepository: { find: jest.Mock }
  let findOneProductProvider: { findOneByIdOrFail: jest.Mock }
  let uploadsService: { deleteFile: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    productsRepository = { softDelete: jest.fn().mockResolvedValue(undefined) }
    uploadFilesRepository = { find: jest.fn() }
    findOneProductProvider = {
      findOneByIdOrFail: jest.fn().mockResolvedValue({ id: 5 }),
    }
    uploadsService = { deleteFile: jest.fn().mockResolvedValue(undefined) }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProductProvider,
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

    provider = module.get(DeleteProductProvider)
  })

  it('purges every uploaded image from Cloudinary before soft-deleting', async () => {
    uploadFilesRepository.find.mockResolvedValue([
      { path: 'url-1' },
      { path: 'url-2' },
    ])

    const result = await provider.softDelete(5, 9)

    expect(uploadFilesRepository.find).toHaveBeenCalledWith({
      where: { productId: 5 },
    })
    expect(uploadsService.deleteFile).toHaveBeenCalledTimes(2)
    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-1')
    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-2')
    expect(productsRepository.softDelete).toHaveBeenCalledWith(5)
    expect(auditLogService.log).toHaveBeenCalledWith(
      9,
      AuditAction.SOFT_DELETE,
      'Product',
      5,
    )
    expect(result).toEqual({ deleted: true, id: 5 })
  })

  it('soft-deletes a product with no images without calling storage', async () => {
    uploadFilesRepository.find.mockResolvedValue([])

    await provider.softDelete(5, 9)

    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
    expect(productsRepository.softDelete).toHaveBeenCalledWith(5)
  })
})
