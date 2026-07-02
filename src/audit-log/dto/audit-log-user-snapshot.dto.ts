import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Snapshot of the actor behind an audit log row. AuditLog has no FK to User
 * (rows must survive the user being hard-deleted — see audit-log/CLAUDE.md),
 * so this is assembled from a second lookup, not a join. All fields are
 * always present so the frontend never has to branch on `deleted` before
 * reading the rest of the shape.
 */
export class AuditLogUserSnapshot {
  @ApiProperty({ example: 42 })
  id!: number

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Ada' })
  firstName!: string | null

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Lovelace' })
  lastName!: string | null

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'ada@example.com',
  })
  email!: string | null

  @ApiProperty({
    description:
      'True when the referenced user no longer exists (hard-deleted)',
    example: false,
  })
  deleted!: boolean
}
