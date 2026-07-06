import { Test, TestingModule } from '@nestjs/testing'
import { ProductsService } from './products.service'
import { FindAllProductsProvider } from './find-all-products.provider'
import { FindOneProductProvider } from './find-one-product.provider'
import { FindRelatedProductsProvider } from './find-related-products.provider'
import { CreateProductProvider } from './create-product.provider'
import { UpdateProductProvider } from './update-product.provider'
import { DeleteProductProvider } from './delete-product.provider'
import { UploadProductImageProvider } from './upload-product-image.provider'
import { FindProductImagesProvider } from './find-product-images.provider'
import { DeleteProductImageProvider } from './delete-product-image.provider'
import { Product } from '../entities/product.entity'

// ProductsService.findBySlug composes FindOneProductProvider and
// FindRelatedProductsProvider to embed related products when ?includeRelated
// is requested. All providers are mocked so no real DB is needed.
describe('ProductsService.findBySlug', () => {
  let service: ProductsService
  let findOneProductProvider: { findOneBySlugOrFail: jest.Mock }
  let findRelatedProductsProvider: { findRelated: jest.Mock }

  beforeEach(async () => {
    findOneProductProvider = { findOneBySlugOrFail: jest.fn() }
    findRelatedProductsProvider = { findRelated: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: FindAllProductsProvider, useValue: {} },
        { provide: FindOneProductProvider, useValue: findOneProductProvider },
        {
          provide: FindRelatedProductsProvider,
          useValue: findRelatedProductsProvider,
        },
        { provide: CreateProductProvider, useValue: {} },
        { provide: UpdateProductProvider, useValue: {} },
        { provide: DeleteProductProvider, useValue: {} },
        { provide: UploadProductImageProvider, useValue: {} },
        { provide: FindProductImagesProvider, useValue: {} },
        { provide: DeleteProductImageProvider, useValue: {} },
      ],
    }).compile()

    service = module.get(ProductsService)
  })

  it('leaves related undefined when includeRelated is not passed', async () => {
    const product = { id: 1, slug: 'test-slug' } as Product
    findOneProductProvider.findOneBySlugOrFail.mockResolvedValue(product)

    const result = await service.findBySlug('test-slug')

    expect(result.related).toBeUndefined()
    expect(findRelatedProductsProvider.findRelated).not.toHaveBeenCalled()
  })

  it('populates related when includeRelated is passed', async () => {
    const product = { id: 1, slug: 'test-slug' } as Product
    const related = [{ id: 2 }, { id: 3 }] as Product[]
    findOneProductProvider.findOneBySlugOrFail.mockResolvedValue(product)
    findRelatedProductsProvider.findRelated.mockResolvedValue(related)

    const result = await service.findBySlug('test-slug', 2)

    expect(result.related).toBe(related)
    expect(findRelatedProductsProvider.findRelated).toHaveBeenCalledWith(1, 2)
  })
})
