import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Requester identity embedded on admin-only SavedConfiguration reads (GET
 * /saved-configurations/admin and /admin/:id). Deliberately leaner than
 * PublicAuthor (src/users/dto/public-author.dto.ts) — the quote-request
 * inbox needs enough to identify who asked, not avatarUrl/bio.
 */
export class SavedConfigurationRequester {
  // requester id
  @ApiProperty({ example: 1 })
  id!: number

  // requester first name
  @ApiProperty({ example: 'Ada' })
  firstName!: string

  // requester last name — nullable
  @ApiPropertyOptional({ type: String, example: 'Lovelace', nullable: true })
  lastName?: string | null

  // requester email
  @ApiProperty({ example: 'ada@example.com' })
  email!: string
}
