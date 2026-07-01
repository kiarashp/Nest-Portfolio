/**
 * Data seed script. Works against any environment, exactly like admin.seed.ts
 * — point NODE_ENV at the target env and it reads that env's DB credentials.
 *
 * Fills the database with one user per role, a handful of tags and posts,
 * and a small product catalog, so the app can be exercised end-to-end
 * without manually clicking through every form:
 *
 *   SEED_ADMIN_EMAIL=you@example.com   SEED_ADMIN_PASSWORD=yourpassword   \
 *   SEED_EDITOR_EMAIL=ed@example.com   SEED_EDITOR_PASSWORD=yourpassword  \
 *   SEED_AUTHOR_EMAIL=au@example.com   SEED_AUTHOR_PASSWORD=yourpassword  \
 *   SEED_USER_EMAIL=user@example.com   SEED_USER_PASSWORD=yourpassword    \
 *   pnpm run seed:dev
 *
 * Safe to run multiple times — every record is created idempotently
 * (looked up by its unique email/slug first, skipped if it already exists).
 *
 * The tags/posts/product-types/products below are placeholder example
 * content (precision-tools starter catalog). If you run this against
 * production, edit that content first — it will be created exactly as
 * written, published and publicly visible.
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

  const tagsService = app.get(TagsService)
  const postsService = app.get(PostsService)
  const productTypesService = app.get(ProductTypesService)
  const productsService = app.get(ProductsService)

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

  await app.close()
  process.exit(0)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
