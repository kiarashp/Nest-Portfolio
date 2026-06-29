import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Public-facing author shape embedded in post responses. The `User` entity is
 * also served by `UsersController` with the 'admin' serialization group, which
 * exposes `email`/`role`/`isEmailVerified`; post responses do not. A single
 * `User` OpenAPI schema cannot represent both, so this class documents exactly
 * the fields a post's `author` actually contains. It is a documentation-only
 * model — runtime filtering still comes from the `User` entity's
 * class-transformer groups, never from this class.
 */
export class PublicAuthor {
  // author id
  @ApiProperty({ example: 1 })
  id!: number

  // author first name
  @ApiProperty({ example: 'Ada' })
  firstName!: string

  // author last name — nullable
  @ApiPropertyOptional({ type: String, example: 'Lovelace', nullable: true })
  lastName?: string | null

  // cloudinary avatar URL, null until the user uploads one
  @ApiPropertyOptional({ type: String, nullable: true })
  avatarUrl?: string | null

  // short plain-text bio shown on author cards
  @ApiPropertyOptional({ type: String, nullable: true })
  bio?: string | null
}
