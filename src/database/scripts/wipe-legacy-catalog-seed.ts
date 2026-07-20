import { In } from 'typeorm'
import AppDataSource from '../data-source'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { Post } from 'src/posts/entities/post.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'

// One-off, one-time script: full nuke of the product catalog (every Product,
// ProductType, and any UploadFile row tied to one) plus the 4 posts from the
// old placeholder "precision-tools starter catalog" seed, so the rebuilt
// dev-data.seed.ts (real Faradis Industrial Group catalog) starts on a
// genuinely clean slate instead of layering on top of leftover placeholder
// seed data, ad-hoc QA/test products (gallery-test-product,
// e2e-verify-product-*, debug-product-x, etc.), and manual experiments.
// Hard-deletes via raw query builder (not soft-delete, not
// repository.delete({}) which does not accept an empty criteria object) so
// nothing lingers even under ?withDeleted. Cloudinary assets referenced by
// deleted UploadFile rows are NOT purged from Cloudinary itself — only the DB
// rows are removed; clean those up in the Cloudinary dashboard separately if
// needed. Users and tags are left untouched. Not wired into any npm script,
// run manually once:
//   NODE_ENV=development ts-node -r tsconfig-paths/register src/database/scripts/wipe-legacy-catalog-seed.ts

const LEGACY_POST_SLUGS = [
  'announcing-thermocouple-line',
  'behind-the-scenes-cable-manufacturing',
  'q3-product-roadmap',
  'upcoming-trade-show-appearance',
]

async function main() {
  await AppDataSource.initialize()

  const uploadFilesRepository = AppDataSource.getRepository(UploadFile)
  const productsRepository = AppDataSource.getRepository(Product)
  const productTypesRepository = AppDataSource.getRepository(ProductType)
  const postsRepository = AppDataSource.getRepository(Post)

  const uploadFilesResult = await uploadFilesRepository
    .createQueryBuilder()
    .delete()
    .where('"productId" IS NOT NULL')
    .orWhere('"productTypeId" IS NOT NULL')
    .execute()
  console.log(
    `Deleted ${uploadFilesResult.affected ?? 0} product/product-type upload_file row(s).`,
  )

  const productsResult = await productsRepository
    .createQueryBuilder()
    .delete()
    .execute()
  console.log(`Deleted ${productsResult.affected ?? 0} product(s).`)

  const productTypesResult = await productTypesRepository
    .createQueryBuilder()
    .delete()
    .execute()
  console.log(`Deleted ${productTypesResult.affected ?? 0} product type(s).`)

  const postsResult = await postsRepository.delete({
    slug: In(LEGACY_POST_SLUGS),
  })
  console.log(`Deleted ${postsResult.affected ?? 0} legacy post(s).`)

  await AppDataSource.destroy()
}

main().catch((error) => {
  console.error('Wipe failed:', error)
  process.exit(1)
})
