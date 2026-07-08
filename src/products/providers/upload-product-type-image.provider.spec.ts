import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UploadProductTypeImageProvider } from './upload-product-type-image.provider'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'
import { ProductType } from '../entities/product-type.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { UploadsService } from 'src/uploads/providers/uploads.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

describe('UploadProductTypeImageProvider', () => {
  let provider: UploadProductTypeImageProvider
  let productTypesRepository: { save: jest.Mock }
  let uploadFilesRepository: { findOne: jest.Mock }
  let findOneProductTypeProvider: { findOneByIdOrFail: jest.Mock }
  let uploadsService: { deleteFile: jest.Mock; uploadFile: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    productTypesRepository = { save: jest.fn().mockResolvedValue(undefined) }
    uploadFilesRepository = { findOne: jest.fn() }
    findOneProductTypeProvider = { findOneByIdOrFail: jest.fn() }
    uploadsService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      uploadFile: jest.fn(),
    }
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadProductTypeImageProvider,
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

    provider = module.get(UploadProductTypeImageProvider)
  })

  it('uploads the file and sets imageUrl when no image was previously tracked', async () => {
    const productType = { id: 3, imageUrl: null }
    findOneProductTypeProvider.findOneByIdOrFail.mockResolvedValue(productType)
    uploadFilesRepository.findOne.mockResolvedValue(null)
    uploadsService.uploadFile.mockResolvedValue({ id: 10, path: 'url-new' })

    const file = {} as Express.Multer.File
    const result = await provider.upload(file, 3, 9)

    expect(uploadFilesRepository.findOne).toHaveBeenCalledWith({
      where: { productTypeId: 3 },
    })
    expect(uploadsService.deleteFile).not.toHaveBeenCalled()
    expect(uploadsService.uploadFile).toHaveBeenCalledWith(
      file,
      9,
      'product-types/3',
      { productTypeId: 3 },
    )
    expect(productType.imageUrl).toBe('url-new')
    expect(productTypesRepository.save).toHaveBeenCalledWith(productType)
    expect(auditLogService.log).toHaveBeenCalledWith(
      9,
      AuditAction.UPDATE,
      'ProductType',
      3,
    )
    expect(result).toBe(productType)
  })

  it('purges the previously tracked image before uploading the replacement', async () => {
    const productType = { id: 3, imageUrl: 'url-old' }
    findOneProductTypeProvider.findOneByIdOrFail.mockResolvedValue(productType)
    uploadFilesRepository.findOne.mockResolvedValue({
      id: 5,
      productTypeId: 3,
      path: 'url-old',
    })
    uploadsService.uploadFile.mockResolvedValue({ id: 11, path: 'url-new' })

    const file = {} as Express.Multer.File
    await provider.upload(file, 3, 9)

    expect(uploadsService.deleteFile).toHaveBeenCalledWith('url-old')
    expect(productType.imageUrl).toBe('url-new')
  })
})
