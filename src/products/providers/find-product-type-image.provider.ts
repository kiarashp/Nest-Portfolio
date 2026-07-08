import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { FindOneProductTypeProvider } from './find-one-product-type.provider'

@Injectable()
export class FindProductTypeImageProvider {
  constructor(
    /** inject UploadFile repository to query the image linked to a product type */
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    /** inject find-one provider to verify the product type exists */
    private readonly findOneProductTypeProvider: FindOneProductTypeProvider,
  ) {}

  /**
   * Returns the single image tracked for the given product type, for the admin
   * edit form. Throws NotFoundException if the type does not exist or has no
   * tracked image.
   */
  public async findProductTypeImage(
    productTypeId: number,
  ): Promise<UploadFile> {
    await this.findOneProductTypeProvider.findOneByIdOrFail(productTypeId)

    const file = await this.uploadFilesRepository.findOne({
      where: { productTypeId },
    })
    if (!file) throw new NotFoundException('Image not found')
    return file
  }
}
