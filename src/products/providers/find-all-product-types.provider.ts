import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductType } from '../entities/product-type.entity'

@Injectable()
export class FindAllProductTypesProvider {
  constructor(
    /** inject ProductType repository for reading type rows */
    @InjectRepository(ProductType)
    private readonly productTypesRepository: Repository<ProductType>,
  ) {}

  /**
   * Returns all product types ordered by name. No pagination — the set is
   * small and stable; the frontend needs the full list to render the type picker.
   */
  public async findAll(): Promise<ProductType[]> {
    return this.productTypesRepository.find({ order: { name: 'ASC' } })
  }
}
