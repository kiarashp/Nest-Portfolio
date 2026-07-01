/**
 * Dev-data seed script. Dev-only — never run this against production.
 *
 * Fills a fresh dev database with one user per role, a handful of tags and
 * posts, and a small product catalog, so the app can be exercised end-to-end
 * without manually clicking through every form:
 *
 *   SEED_ADMIN_EMAIL=you@example.com \
 *   SEED_ADMIN_PASSWORD=yourpassword  \
 *   pnpm run seed:dev
 *
 * Safe to run multiple times — every record is created idempotently
 * (looked up by its unique email/slug first, skipped if it already exists).
 */

import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { DevSeedModule } from './dev-seed.module'
import { User } from 'src/users/entities/user.entity'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { Tag } from 'src/tags/entities/tag.entity'
import { Post } from 'src/posts/entities/post.entity'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { TagsService } from 'src/tags/providers/tags.service'
import { PostsService } from 'src/posts/providers/posts.service'
import { ProductsService } from 'src/products/providers/products.service'
import { ProductTypesService } from 'src/products/providers/product-types.service'
import { PostStatus } from 'src/posts/enums/postStatus.enum'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'

// Dev-only accounts — hardcoded because this script only ever runs against a
// local dev database, never production.
const DEV_USERS = [
  {
    firstName: 'Eve',
    lastName: 'Editor',
    email: 'editor@example.com',
    role: UserRole.EDITOR,
  },
  {
    firstName: 'Ada',
    lastName: 'Author',
    email: 'author@example.com',
    role: UserRole.AUTHOR,
  },
  {
    firstName: 'Uma',
    lastName: 'User',
    email: 'user@example.com',
    role: UserRole.USER,
  },
]
const DEV_USER_PASSWORD = 'DevPassword123!'

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
  if (process.env.NODE_ENV === 'production') {
    console.error('Error: dev-data.seed.ts must never run against production')
    process.exit(1)
  }

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

  const tagsService = app.get(TagsService)
  const postsService = app.get(PostsService)
  const productTypesService = app.get(ProductTypesService)
  const productsService = app.get(ProductsService)

  // --- Users ---------------------------------------------------------------

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminPassword) {
    console.error('Error: SEED_ADMIN_PASSWORD environment variable is required')
    await app.close()
    process.exit(1)
  }

  const admin = await findOrCreateUser(userRepository, {
    firstName: 'Admin',
    lastName: null,
    email: adminEmail,
    role: UserRole.ADMIN,
    password: adminPassword,
  })

  const [editor, author, regularUser] = await Promise.all(
    DEV_USERS.map((data) =>
      findOrCreateUser(userRepository, {
        ...data,
        password: DEV_USER_PASSWORD,
      }),
    ),
  )

  // --- Tags ------------------------------------------------------------------

  const tagDefs = [
    { name: 'News', slug: 'news', schema: '{}' },
    { name: 'Engineering', slug: 'engineering', schema: '{}' },
    { name: 'Announcements', slug: 'announcements', schema: '{}' },
    { name: 'Product Updates', slug: 'product-updates', schema: '{}' },
  ]

  const tags: Tag[] = []
  for (const dto of tagDefs) {
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
      title: 'Announcing Our New Thermocouple Line',
      slug: 'announcing-thermocouple-line',
      status: PostStatus.PUBLISHED,
      content:
        'We are excited to introduce a new range of precision thermocouples.',
      tags: [newsTag.id, announcementsTag.id],
      author: editor,
    },
    {
      title: 'Behind the Scenes: Cable Manufacturing',
      slug: 'behind-the-scenes-cable-manufacturing',
      status: PostStatus.PUBLISHED,
      content: 'A look at how our precision cables are engineered and tested.',
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
      content: 'Details on our booth at the upcoming industry trade show.',
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
        metaOptions: { metaValue: '{"seed":true}' },
      },
      toActiveUser(dto.author),
    )
    console.log(`Created post "${created.slug}" (id: ${created.id})`)
  }

  // --- Product types ---------------------------------------------------------

  const productTypeDefs = [
    {
      name: 'Thermocouples',
      slug: 'thermocouples',
      filterableFields: [
        {
          key: 'tempRange',
          label: 'Temperature Range',
          type: 'number' as const,
          unit: '°C',
        },
        {
          key: 'sheathMaterial',
          label: 'Sheath Material',
          type: 'enum' as const,
          options: ['Inconel 600', 'Stainless 316'],
        },
      ],
    },
    {
      name: 'Cables',
      slug: 'cables',
      filterableFields: [
        {
          key: 'conductorGauge',
          label: 'Conductor Gauge',
          type: 'number' as const,
          unit: 'AWG',
        },
        {
          key: 'insulation',
          label: 'Insulation',
          type: 'enum' as const,
          options: ['PTFE', 'PVC', 'Silicone'],
        },
      ],
    },
  ]

  const productTypes: ProductType[] = []
  for (const dto of productTypeDefs) {
    const existing = await productTypeRepository.findOne({
      where: { slug: dto.slug },
    })
    if (existing) {
      console.log(
        `Product type "${dto.slug}" already exists (id: ${existing.id}) — skipping`,
      )
      productTypes.push(existing)
      continue
    }
    const created = await productTypesService.create(dto, admin.id)
    console.log(`Created product type "${created.slug}" (id: ${created.id})`)
    productTypes.push(created)
  }
  const [thermocouplesType, cablesType] = productTypes

  // --- Products ---------------------------------------------------------------

  const productDefs = [
    {
      name: 'Type K Thermocouple',
      slug: 'type-k-thermocouple',
      productTypeId: thermocouplesType.id,
      shortDescription: 'High-accuracy thermocouple for industrial use',
      imageUrl: 'https://placehold.co/600x400?text=Type+K+Thermocouple',
      specs: { tempRange: 1260, sheathMaterial: 'Inconel 600' },
    },
    {
      name: 'Type J Thermocouple',
      slug: 'type-j-thermocouple',
      productTypeId: thermocouplesType.id,
      shortDescription: 'Reliable thermocouple for moderate temperature ranges',
      imageUrl: 'https://placehold.co/600x400?text=Type+J+Thermocouple',
      specs: { tempRange: 760, sheathMaterial: 'Stainless 316' },
    },
    {
      name: 'High-Temp Sheathed Thermocouple',
      slug: 'high-temp-sheathed-thermocouple',
      productTypeId: thermocouplesType.id,
      shortDescription: 'Sheathed thermocouple rated for extreme temperatures',
      imageUrl: 'https://placehold.co/600x400?text=High+Temp+Thermocouple',
      specs: { tempRange: 1600, sheathMaterial: 'Inconel 600' },
    },
    {
      name: 'PTFE Signal Cable',
      slug: 'ptfe-signal-cable',
      productTypeId: cablesType.id,
      shortDescription: 'PTFE-insulated cable for high-temperature signal runs',
      imageUrl: 'https://placehold.co/600x400?text=PTFE+Signal+Cable',
      specs: { conductorGauge: 22, insulation: 'PTFE' },
    },
    {
      name: 'Silicone Power Cable',
      slug: 'silicone-power-cable',
      productTypeId: cablesType.id,
      shortDescription: 'Flexible silicone-insulated power cable',
      imageUrl: 'https://placehold.co/600x400?text=Silicone+Power+Cable',
      specs: { conductorGauge: 14, insulation: 'Silicone' },
    },
    {
      name: 'PVC Hookup Wire',
      slug: 'pvc-hookup-wire',
      productTypeId: cablesType.id,
      shortDescription: 'General-purpose PVC-insulated hookup wire',
      imageUrl: 'https://placehold.co/600x400?text=PVC+Hookup+Wire',
      specs: { conductorGauge: 18, insulation: 'PVC' },
    },
  ]

  for (const dto of productDefs) {
    const existing = await productRepository.findOne({
      where: { slug: dto.slug },
    })
    if (existing) {
      console.log(
        `Product "${dto.slug}" already exists (id: ${existing.id}) — skipping`,
      )
      continue
    }
    const created = await productsService.create(
      { ...dto, isPublished: true },
      admin.id,
    )
    console.log(`Created product "${created.slug}" (id: ${created.id})`)
  }

  console.log('\nSeed summary:')
  console.log(
    `  Users: admin=${admin.email}, editor=${editor.email}, author=${author.email}, user=${regularUser.email}`,
  )
  console.log(
    `  Dev account password (editor/author/user): ${DEV_USER_PASSWORD}`,
  )

  await app.close()
  process.exit(0)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
