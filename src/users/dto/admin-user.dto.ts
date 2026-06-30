import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from 'src/auth/enums/user-role.enum'

/**
 * Admin-facing user shape returned by the admin-grouped `UsersController`
 * endpoints (`GET /users`, `GET /users/:id`, `GET /users/me`). Those responses
 * run under the `admin` serialization group, which exposes `email`, `role`, and
 * `isEmailVerified` on top of the public fields. The public author view hides
 * those three (see `PublicAuthor`), so a single `User` OpenAPI schema cannot
 * represent both contexts. This class documents exactly the admin-group fields.
 * It is a documentation-only model — runtime filtering still comes from the
 * `User` entity's class-transformer groups, never from this class.
 */
export class AdminUser {
  // user id
  @ApiProperty({ example: 1 })
  id!: number

  // first name
  @ApiProperty({ example: 'Ada' })
  firstName!: string

  // last name — nullable
  @ApiPropertyOptional({ type: String, example: 'Lovelace', nullable: true })
  lastName?: string | null

  // cloudinary avatar URL, null until the user uploads or selects one
  @ApiPropertyOptional({ type: String, nullable: true })
  avatarUrl?: string | null

  // short plain-text bio
  @ApiPropertyOptional({ type: String, nullable: true })
  bio?: string | null

  // login email — only exposed under the admin serialization group
  @ApiProperty({ example: 'ada@example.com' })
  email!: string

  // access-control role — only exposed under the admin serialization group
  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole

  // whether the user has confirmed their email — admin group only
  @ApiProperty({ example: true })
  isEmailVerified!: boolean
}
