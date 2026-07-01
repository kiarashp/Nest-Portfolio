import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from '../entities/product.entity'
import { FilterableField } from '../entities/product-type.entity'
import { classifyTypeChange } from './classify-type-change.util'

@Injectable()
export class ValidateTypeChangeProvider {
  private readonly logger = new Logger(ValidateTypeChangeProvider.name)

  constructor(
    /** inject Product repository to count products affected by a field/option removal */
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Blocks a filterableFields change that would strand existing product data.
   * classifyTypeChange first rejects illegal in-place edits (a field type change).
   * This method then counts the products still holding data for each removed field
   * or removed enum option and throws ConflictException naming every conflict.
   * Returns silently when the change is safe.
   */
  public async assertChangesSafe(
    typeId: number,
    oldFields: FilterableField[] | null | undefined,
    newFields: FilterableField[] | null | undefined,
  ): Promise<void> {
    // May throw BadRequestException (400) on an illegal type change.
    const checks = classifyTypeChange(oldFields, newFields)
    if (checks.length === 0) return

    const conflicts: string[] = []

    for (const check of checks) {
      // jsonb access (specs ->> key) needs a QueryBuilder — a plain where object
      // cannot express it. Soft-deleted products are excluded by default, which is
      // correct: they are neither shown nor edited.
      const qb = this.productsRepository
        .createQueryBuilder('product')
        .where('product.productTypeId = :typeId', { typeId })

      if (check.kind === 'fieldRemoved') {
        qb.andWhere('product.specs ->> :key IS NOT NULL', { key: check.key })
        const count = await qb.getCount()
        if (count > 0) {
          conflicts.push(
            `field "${check.key}" is still used by ${count} product(s)`,
          )
        }
      } else if (
        check.kind === 'optionsRemoved' &&
        check.removedOptions &&
        check.removedOptions.length > 0
      ) {
        qb.andWhere('product.specs ->> :key IN (:...opts)', {
          key: check.key,
          opts: check.removedOptions,
        })
        const count = await qb.getCount()
        if (count > 0) {
          conflicts.push(
            `option(s) ${check.removedOptions.join(', ')} on "${check.key}" are still used by ${count} product(s)`,
          )
        }
      }
    }

    if (conflicts.length > 0) {
      this.logger.warn(
        `Blocked product type update — typeId=${typeId}: ${conflicts.join('; ')}`,
      )
      throw new ConflictException(
        `Cannot update this product type — ${conflicts.join('; ')}. ` +
          `Clear those products' specs first, or keep the field.`,
      )
    }
  }
}
