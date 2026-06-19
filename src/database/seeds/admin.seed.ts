/**
 * Admin seed script.
 *
 * Run once to create (or promote) the first admin user:
 *
 *   SEED_ADMIN_EMAIL=you@example.com \
 *   SEED_ADMIN_PASSWORD=yourpassword  \
 *   pnpm exec ts-node -r tsconfig-paths/register src/database/seeds/admin.seed.ts
 *
 * - If the email does not exist → creates a new user with role ADMIN.
 * - If the email already exists → promotes that user to ADMIN (leaves password
 *   and all other fields untouched).
 *
 * Safe to run multiple times — it will not create duplicate users.
 */

import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { SeedModule } from './seed.module'
import { User } from 'src/users/entities/user.entity'
import { UserRole } from 'src/auth/enums/user-role.enum'

async function seed() {
  // Boot the DI container without starting an HTTP server.
  // SeedModule only wires up ConfigModule + TypeORM — nothing else.
  const app = await NestFactory.createApplicationContext(SeedModule, {
    // Suppress the NestJS startup banner — this is a script, not a server.
    logger: ['error', 'warn'],
  })

  // getRepositoryToken(User) is how NestJS names the TypeORM repository inside
  // the DI container. It returns the same Repository<User> you would get via
  // @InjectRepository(User) in a service.
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User))

  // Read credentials from environment variables so this script never contains
  // a hardcoded password. SEED_ADMIN_EMAIL defaults to something obvious so
  // you notice it immediately if you forget to set it.
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!password) {
    console.error('Error: SEED_ADMIN_PASSWORD environment variable is required')
    console.error(
      'Usage: SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=secret pnpm exec ts-node ...',
    )
    await app.close()
    process.exit(1)
  }

  const existing = await userRepository.findOne({ where: { email } })

  if (existing) {
    // User already exists — just change the role. We do not touch the
    // password; if they want to reset it they can use the sign-in flow.
    existing.role = UserRole.ADMIN
    await userRepository.save(existing)
    console.log(
      `Promoted existing user "${email}" to ADMIN (id: ${existing.id})`,
    )
  } else {
    // User does not exist — create a fresh admin account.
    // We hash the password directly with bcrypt here instead of going through
    // HashingProvider, because pulling in AuthModule just for one bcrypt call
    // would drag in JWT, guards, and a circular dependency with UsersModule.
    const salt = await bcrypt.genSalt()
    const hashedPassword = await bcrypt.hash(password, salt)

    const admin = userRepository.create({
      firstName: 'Admin',
      lastName: null,
      email,
      password: hashedPassword,
      role: UserRole.ADMIN,
      // Column default is false — set explicitly so the admin can sign in immediately.
      isEmailVerified: true,
    })

    await userRepository.save(admin)
    console.log(`Created admin user "${email}" (id: ${admin.id})`)
  }

  // Close the TypeORM connection cleanly. Without this the script hangs
  // because the Postgres connection pool keeps the Node process alive.
  await app.close()
  process.exit(0)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
