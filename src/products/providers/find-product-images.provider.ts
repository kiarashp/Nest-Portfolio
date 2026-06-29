import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOneProductProvider } from './find-one-product.provider'

@Injectable()
export class FindProductImagesProvider {
  constructor(
    /** inject UploadFile repository to query images linked to a product */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider to verify the product exists */
    private readonly findOneProductProvider: FindOneProductProvider,
  ) {}

  /**
   * Returns all images uploaded for the given product, for the admin image
   * picker. Product image management is admin-only, so there is no per-user
   * ownership check (unlike post images).
   */
  public async findProductImages(productId: number): Promise<UploadFile[]> {
    // Throws NotFoundException if the product does not exist.
    await this.findOneProductProvider.findOneByIdOrFail(productId)

    return await this.uploadFilesRepository.find({ where: { productId } })
  }
}
