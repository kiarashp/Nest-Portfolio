import * as bcrypt from 'bcrypt'
import { DataSource } from 'typeorm'
import { User } from '../../src/users/entities/user.entity'
import { UserRole } from '../../src/auth/enums/user-role.enum'

interface SeedUserOptions {
  email: string
  /** Plain-text password — hashed internally with bcrypt. */
  password: string
  firstName?: string
  role?: UserRole
  /** Defaults to true so tests don't need to go through email verification. */
  isEmailVerified?: boolean
}

// Creates a user row directly in the DB, bypassing the registration flow.
// Handles bcrypt hashing internally so test files stay free of that detail.
export async function seedUser(
  dataSource: DataSource,
  options: SeedUserOptions,
): Promise<User> {
  const userRepo = dataSource.getRepository(User)
  return userRepo.save({
    firstName: options.firstName ?? 'Test',
    email: options.email,
    password: await bcrypt.hash(options.password, 10),
    isEmailVerified: options.isEmailVerified ?? true,
    role: options.role ?? UserRole.USER,
  })
}

// Deletes users by email — use in afterAll to clean up seeded rows.
// Silently skips emails that no longer exist (e.g. deleted in a test).
export async function cleanupUsers(
  dataSource: DataSource,
  emails: string[],
): Promise<void> {
  const userRepo = dataSource.getRepository(User)
  for (const email of emails) {
    await userRepo.delete({ email })
  }
}
