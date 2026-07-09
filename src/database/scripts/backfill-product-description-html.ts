import AppDataSource from '../data-source'
import { Product } from 'src/products/entities/product.entity'
import { renderMarkdownToHtml } from 'src/common/utils/render-markdown-to-html.util'

const BATCH_SIZE = 50

/**
 * One-off script: re-renders descriptionHtml for every existing product
 * whose description is not yet reflected in descriptionHtml (e.g. rows
 * created before the descriptionHtml column existed). Includes soft-deleted
 * products since there is no restore endpoint, so a soft-deleted row's
 * descriptionHtml can still be read via ?withDeleted queries. Not wired into
 * any npm script — run manually with the same NODE_ENV pattern as the seed
 * scripts:
 *   NODE_ENV=development ts-node -r tsconfig-paths/register src/database/scripts/backfill-product-description-html.ts
 */
async function main() {
  await AppDataSource.initialize()
  const productsRepository = AppDataSource.getRepository(Product)

  let offset = 0
  let updated = 0
  for (;;) {
    const products: Product[] = await productsRepository.find({
      where: {},
      skip: offset,
      take: BATCH_SIZE,
      order: { id: 'ASC' },
      withDeleted: true,
    })
    if (products.length === 0) break

    for (const product of products) {
      if (product.description) {
        product.descriptionHtml = renderMarkdownToHtml(product.description)
        await productsRepository.save(product)
        updated++
      }
    }

    offset += BATCH_SIZE
  }

  console.log(`Backfilled descriptionHtml for ${updated} product(s).`)
  await AppDataSource.destroy()
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
