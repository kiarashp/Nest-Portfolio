import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../entities/product.entity'

@Injectable()
export class FindOneProductProvider {
  constructor(
    /** inject Product repository */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Returns the product or null. Includes any publication status — used
   * internally by admin providers that need to edit or delete drafts.
   */
  public async findOneById(id: number): Promise<Product | null> {
    try {
      return await this.productsRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }

  /**
   * Returns the product or throws NotFoundException. Use when a missing product
   * is always an error (admin write operations, image upload, etc.).
   */
  public async findOneByIdOrFail(id: number): Promise<Product> {
    const product = await this.findOneById(id)
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`)
    }
    return product
  }

  /**
   * Public-facing lookup by ID — only returns the product when it is published.
   * Returns 404 for drafts and soft-deleted products so unpublished content is
   * indistinguishable from non-existent content to anonymous callers.
   */
  public async findOnePublishedByIdOrFail(id: number): Promise<Product> {
    let product: Product | null = null
    try {
      product = await this.productsRepository.findOne({
        where: { id, isPublished: true },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`)
    }
    return product
  }

  /**
   * Public-facing lookup by slug — same published-only rule as the ID variant.
   */
  public async findOneBySlugOrFail(slug: string): Promise<Product> {
    let product: Product | null = null
    try {
      product = await this.productsRepository.findOne({
        where: { slug, isPublished: true },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`)
    }
    return product
  }

  /**
   * Public-facing lookup by SKU — same published-only rule as the slug variant.
   */
  public async findOneBySkuOrFail(sku: string): Promise<Product> {
    let product: Product | null = null
    try {
      product = await this.productsRepository.findOne({
        where: { sku, isPublished: true },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!product) {
      throw new NotFoundException(`Product with SKU "${sku}" not found`)
    }
    return product
  }
}
