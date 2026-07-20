/**
 * Data seed script. Works against any environment, exactly like admin.seed.ts
 * — point NODE_ENV at the target env and it reads that env's DB credentials.
 *
 * Fills the database with one user per role, a handful of tags and posts, the
 * real Faradis Industrial Group product catalog (product types, products with
 * real specs/SKUs), and the real FRH headmount RTD ordering-code configurator
 * — see dev-seed-data.ts for the underlying data and forseeding.md (repo root)
 * for its source. Product/product-type/configurable-product images are real
 * photos read from the repo-root seed-images/ directory and uploaded through
 * the actual StorageProvider (local disk or Cloudinary, whichever
 * STORAGE_DRIVER is active), exactly like a real admin upload would:
 *
 *   SEED_ADMIN_EMAIL=you@example.com   SEED_ADMIN_PASSWORD=yourpassword   \
 *   SEED_EDITOR_EMAIL=ed@example.com   SEED_EDITOR_PASSWORD=yourpassword  \
 *   SEED_AUTHOR_EMAIL=au@example.com   SEED_AUTHOR_PASSWORD=yourpassword  \
 *   SEED_USER_EMAIL=user@example.com   SEED_USER_PASSWORD=yourpassword    \
 *   pnpm run seed:dev
 *
 * Safe to run multiple times — every record is created idempotently (looked
 * up by its unique email/slug/name first, skipped if it already exists).
 *
 * This is real catalog content, not placeholder copy. If you run this against
 * production, it is created exactly as written, published and publicly visible.
 */

import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DevSeedModule } from './dev-seed.module'
import { User } from 'src/users/entities/user.entity'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { Tag } from 'src/tags/entities/tag.entity'
import { Post } from 'src/posts/entities/post.entity'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { ConfigurableProduct } from 'src/configurator/entities/configurable-product.entity'
import { SegmentDefinition } from 'src/configurator/entities/segment-definition.entity'
import { TagsService } from 'src/tags/providers/tags.service'
import { PostsService } from 'src/posts/providers/posts.service'
import { ProductsService } from 'src/products/providers/products.service'
import { ProductTypesService } from 'src/products/providers/product-types.service'
import { ConfiguratorDefinitionsService } from 'src/configurator/providers/configurator-definitions.service'
import { ConfiguratorProductsService } from 'src/configurator/providers/configurator-products.service'
import { PostStatus } from 'src/posts/enums/postStatus.enum'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import {
  COMPANY,
  POST_TAGS,
  PRODUCT_TYPES,
  PRODUCTS,
  FRH_SEGMENT_DEFINITIONS,
  FRH_ASSIGNMENTS,
  FRH_CONFIGURABLE_PRODUCT,
} from './dev-seed-data'

// One env-var pair per non-admin role, mirroring SEED_ADMIN_EMAIL/PASSWORD —
// email falls back to an obvious default, password is required.
const ROLE_ENV_PREFIXES = [
  {
    prefix: 'SEED_EDITOR',
    role: UserRole.EDITOR,
    firstName: 'Editor',
    defaultEmail: 'editor@example.com',
  },
  {
    prefix: 'SEED_AUTHOR',
    role: UserRole.AUTHOR,
    firstName: 'Author',
    defaultEmail: 'author@example.com',
  },
  {
    prefix: 'SEED_USER',
    role: UserRole.USER,
    firstName: 'User',
    defaultEmail: 'user@example.com',
  },
]

// Real product/type/configurator photos live here, one level up from the repo
// root's usual working directory when a pnpm script runs (process.cwd() is
// the package.json directory for every npm script, including seed:dev).
const SEED_IMAGES_DIR = path.join(process.cwd(), 'seed-images')

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * Reads a real image from seed-images/ and shapes it like the object Multer's
 * memoryStorage engine hands controllers at runtime. Every storage backend
 * and upload provider only ever reads buffer/originalname/mimetype/size (see
 * src/uploads/CLAUDE.md), so the remaining Express.Multer.File fields are
 * irrelevant here and the object is cast rather than fully populated.
 */
function loadSeedImage(filename: string): Express.Multer.File {
  const filePath = path.join(SEED_IMAGES_DIR, filename)
  const buffer = fs.readFileSync(filePath)
  const extension = path.extname(filename).toLowerCase()
  const mimetype = MIME_TYPES_BY_EXTENSION[extension]
  if (!mimetype) {
    throw new Error(`Unsupported seed image extension: ${filename}`)
  }

  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
  } as unknown as Express.Multer.File
}

async function findOrCreateUser(
  userRepository: Repository<User>,
  data: {
    firstName: string
    lastName: string | null
    email: string
    role: UserRole
    password: string
  },
): Promise<User> {
  const existing = await userRepository.findOne({
    where: { email: data.email },
  })
  if (existing) {
    console.log(
      `User "${data.email}" already exists (id: ${existing.id}) — skipping`,
    )
    return existing
  }

  const salt = await bcrypt.genSalt()
  const hashedPassword = await bcrypt.hash(data.password, salt)

  const user = userRepository.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    password: hashedPassword,
    role: data.role,
    // Set explicitly so the seeded account can sign in immediately — the
    // normal registration flow leaves this false pending a real email click.
    isEmailVerified: true,
  })
  const saved = await userRepository.save(user)
  console.log(`Created ${data.role} user "${data.email}" (id: ${saved.id})`)
  return saved
}

function toActiveUser(user: User): ActiveUserData {
  return { sub: user.id, email: user.email, role: user.role }
}

async function seed() {
  const app = await NestFactory.createApplicationContext(DevSeedModule, {
    logger: ['error', 'warn'],
  })

  const userRepository = app.get<Repository<User>>(getRepositoryToken(User))
  const tagRepository = app.get<Repository<Tag>>(getRepositoryToken(Tag))
  const postRepository = app.get<Repository<Post>>(getRepositoryToken(Post))
  const productTypeRepository = app.get<Repository<ProductType>>(
    getRepositoryToken(ProductType),
  )
  const productRepository = app.get<Repository<Product>>(
    getRepositoryToken(Product),
  )
  const configurableProductRepository = app.get<
    Repository<ConfigurableProduct>
  >(getRepositoryToken(ConfigurableProduct))
  const segmentDefinitionRepository = app.get<Repository<SegmentDefinition>>(
    getRepositoryToken(SegmentDefinition),
  )

  const tagsService = app.get(TagsService)
  const postsService = app.get(PostsService)
  const productTypesService = app.get(ProductTypesService)
  const productsService = app.get(ProductsService)
  const configuratorDefinitionsService = app.get(ConfiguratorDefinitionsService)
  const configuratorProductsService = app.get(ConfiguratorProductsService)

  // --- Users ---------------------------------------------------------------

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  // Resolve every role's email/password up front so a missing password fails
  // fast, before any user has been written.
  const roleUserDefs = ROLE_ENV_PREFIXES.map(
    ({ prefix, role, firstName, defaultEmail }) => ({
      firstName,
      lastName: null,
      role,
      email: process.env[`${prefix}_EMAIL`] ?? defaultEmail,
      password: process.env[`${prefix}_PASSWORD`],
      passwordEnvVar: `${prefix}_PASSWORD`,
    }),
  )

  const missingPasswordVars = [
    ...(adminPassword ? [] : ['SEED_ADMIN_PASSWORD']),
    ...roleUserDefs
      .filter((data) => !data.password)
      .map((data) => data.passwordEnvVar),
  ]

  if (missingPasswordVars.length > 0) {
    console.error(
      `Error: the following environment variables are required: ${missingPasswordVars.join(', ')}`,
    )
    await app.close()
    process.exit(1)
  }

  const admin = await findOrCreateUser(userRepository, {
    firstName: 'Admin',
    lastName: null,
    email: adminEmail,
    role: UserRole.ADMIN,
    password: adminPassword as string,
  })

  const [editor, author, regularUser] = await Promise.all(
    roleUserDefs.map((data) =>
      findOrCreateUser(userRepository, {
        ...data,
        password: data.password as string,
      }),
    ),
  )

  // --- Tags ------------------------------------------------------------------

  const tags: Tag[] = []
  for (const dto of POST_TAGS) {
    const existing = await tagRepository.findOne({ where: { slug: dto.slug } })
    if (existing) {
      console.log(
        `Tag "${dto.slug}" already exists (id: ${existing.id}) — skipping`,
      )
      tags.push(existing)
      continue
    }
    const created = await tagsService.create(dto, admin.id)
    console.log(`Created tag "${created.slug}" (id: ${created.id})`)
    tags.push(created)
  }
  const [newsTag, engineeringTag, announcementsTag, productUpdatesTag] = tags

  // --- Posts -------------------------------------------------------------------

  const postDefs = [
    {
      title: `Announcing Our New Thermocouple Line`,
      slug: 'announcing-thermocouple-line',
      status: PostStatus.PUBLISHED,
      content: `${COMPANY.name} is expanding its thermocouple line with new high-temperature Type K and Type S probes, built for demanding industrial process environments.`,
      tags: [newsTag.id, announcementsTag.id],
      author: editor,
    },
    {
      title: 'Behind the Scenes: RTD Sensor Calibration',
      slug: 'behind-the-scenes-rtd-sensor-calibration',
      status: PostStatus.PUBLISHED,
      content:
        'A look at how our PT100 and PT1000 headmount sensors are calibrated and tested before they leave the factory floor.',
      tags: [engineeringTag.id],
      author: author,
    },
    {
      title: 'Q3 Product Roadmap',
      slug: 'q3-product-roadmap',
      status: PostStatus.DRAFT,
      content: 'Draft notes on what is planned for the next quarter.',
      tags: [productUpdatesTag.id],
      author: author,
    },
    {
      title: 'Upcoming Trade Show Appearance',
      slug: 'upcoming-trade-show-appearance',
      status: PostStatus.REVIEW,
      content: `Details on ${COMPANY.name}'s booth at the upcoming industry trade show.`,
      tags: [newsTag.id],
      author: editor,
    },
  ]

  for (const dto of postDefs) {
    const existing = await postRepository.findOne({ where: { slug: dto.slug } })
    if (existing) {
      console.log(
        `Post "${dto.slug}" already exists (id: ${existing.id}) — skipping`,
      )
      continue
    }
    const created = await postsService.create(
      {
        title: dto.title,
        slug: dto.slug,
        status: dto.status,
        content: dto.content,
        tags: dto.tags,
      },
      toActiveUser(dto.author),
    )
    console.log(`Created post "${created.slug}" (id: ${created.id})`)
  }

  // --- Product types ---------------------------------------------------------

  const productTypeIdBySlug = new Map<string, number>()
  for (const dto of PRODUCT_TYPES) {
    const existing = await productTypeRepository.findOne({
      where: { slug: dto.slug },
    })
    if (existing) {
      console.log(
        `Product type "${dto.slug}" already exists (id: ${existing.id}) — skipping`,
      )
      productTypeIdBySlug.set(dto.slug, existing.id)
      continue
    }

    const created = await productTypesService.create(
      {
        name: dto.name,
        slug: dto.slug,
        filterableFields: dto.filterableFields,
      },
      admin.id,
    )
    await productTypesService.uploadImage(
      loadSeedImage(dto.image),
      created.id,
      admin.id,
    )
    productTypeIdBySlug.set(dto.slug, created.id)
    console.log(`Created product type "${created.slug}" (id: ${created.id})`)
  }

  // --- Products ---------------------------------------------------------------

  for (const dto of PRODUCTS) {
    const existing = await productRepository.findOne({
      where: { slug: dto.slug },
    })
    if (existing) {
      console.log(
        `Product "${dto.slug}" already exists (id: ${existing.id}) — skipping`,
      )
      continue
    }

    const productTypeId = productTypeIdBySlug.get(dto.productTypeSlug)
    if (!productTypeId) {
      throw new Error(
        `Product "${dto.slug}" references unknown product type slug "${dto.productTypeSlug}"`,
      )
    }

    const created = await productsService.create(
      {
        name: dto.name,
        slug: dto.slug,
        sku: dto.sku,
        productTypeId,
        shortDescription: dto.shortDescription,
        description: dto.description,
        specs: dto.specs,
        isPublished: dto.isPublished ?? true,
        isFeatured: dto.isFeatured ?? false,
      },
      admin.id,
    )

    if (dto.images && dto.images.length > 0) {
      const uploadedUrls: string[] = []
      for (const filename of dto.images) {
        const uploadedFile = await productsService.uploadImage(
          loadSeedImage(filename),
          created.id,
          admin.id,
        )
        uploadedUrls.push(uploadedFile.path)
      }
      await productsService.update(
        created.id,
        {
          imageUrl: uploadedUrls[0],
          images: uploadedUrls.length > 1 ? uploadedUrls.slice(1) : undefined,
        },
        admin.id,
      )
    }

    console.log(`Created product "${created.slug}" (id: ${created.id})`)
  }

  // --- Configurator: FRH headmount RTD segment library ------------------------

  const definitionIdByKey = new Map<string, number>()
  for (const def of FRH_SEGMENT_DEFINITIONS) {
    const existing = await segmentDefinitionRepository.findOne({
      where: { name: def.name },
    })
    if (existing) {
      console.log(
        `Segment definition "${def.name}" already exists (id: ${existing.id}) — skipping`,
      )
      definitionIdByKey.set(def.key, existing.id)
      continue
    }

    const created = await configuratorDefinitionsService.create(
      {
        name: def.name,
        label: def.label,
        dataType: def.dataType,
        constraints: def.constraints,
        meaningTemplate: def.meaningTemplate,
      },
      admin.id,
    )
    definitionIdByKey.set(def.key, created.id)

    for (const option of def.options ?? []) {
      await configuratorDefinitionsService.createOption(
        created.id,
        option,
        admin.id,
      )
    }
    console.log(
      `Created segment definition "${created.name}" (id: ${created.id})`,
    )
  }

  // --- Configurator: FRH configurable product + assignments -------------------

  const existingFrhProduct = await configurableProductRepository.findOne({
    where: { slug: FRH_CONFIGURABLE_PRODUCT.slug },
  })
  if (existingFrhProduct) {
    console.log(
      `Configurable product "${FRH_CONFIGURABLE_PRODUCT.slug}" already exists (id: ${existingFrhProduct.id}) — skipping`,
    )
  } else {
    const createdProduct = await configuratorProductsService.create(
      {
        name: FRH_CONFIGURABLE_PRODUCT.name,
        slug: FRH_CONFIGURABLE_PRODUCT.slug,
        codePrefix: FRH_CONFIGURABLE_PRODUCT.codePrefix,
        description: FRH_CONFIGURABLE_PRODUCT.description,
        isPublished: true,
      },
      admin.id,
    )
    await configuratorProductsService.uploadImage(
      loadSeedImage(FRH_CONFIGURABLE_PRODUCT.image),
      createdProduct.id,
      admin.id,
    )

    const assignmentIdByDefinitionKey = new Map<string, number>()
    for (const assignment of FRH_ASSIGNMENTS) {
      const definitionId = definitionIdByKey.get(assignment.definitionKey)
      if (!definitionId) {
        throw new Error(
          `Assignment references unknown segment definition key "${assignment.definitionKey}"`,
        )
      }

      const condition = assignment.condition
        ? {
            controllingAssignmentId: assignmentIdByDefinitionKey.get(
              assignment.condition.controllingKey,
            ),
            operator: assignment.condition.operator,
            value: assignment.condition.value,
            effect: 'zero_fill' as const,
          }
        : undefined
      if (assignment.condition && !condition?.controllingAssignmentId) {
        throw new Error(
          `Condition on "${assignment.definitionKey}" references unknown controlling key "${assignment.condition.controllingKey}"`,
        )
      }

      const createdAssignment =
        await configuratorProductsService.createAssignment(
          createdProduct.id,
          { definitionId, condition },
          admin.id,
        )
      assignmentIdByDefinitionKey.set(
        assignment.definitionKey,
        createdAssignment.id,
      )
    }

    console.log(
      `Created configurable product "${createdProduct.slug}" (id: ${createdProduct.id}) with ${FRH_ASSIGNMENTS.length} assignments`,
    )
  }

  console.log('\nSeed summary:')
  console.log(
    `  Users: admin=${admin.email}, editor=${editor.email}, author=${author.email}, user=${regularUser.email}`,
  )

  await app.close()
  process.exit(0)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
