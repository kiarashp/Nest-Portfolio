import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { AuditLogUserSnapshot } from '../dto/audit-log-user-snapshot.dto'

@Entity('audit_logs')
export class AuditLog {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number

  // The user who performed the action; null when the actor is anonymous (e.g. self-registration).
  // Explicit `type: Number` so the nullable union does not emit empty `Object` metadata.
  @ApiPropertyOptional({ type: Number, nullable: true, example: 42 })
  @Column({ type: 'int', nullable: true })
  userId: number | null

  // One of CREATE, UPDATE, DELETE, SOFT_DELETE — stored as a plain string to keep the
  // table readable without joining to an enum type in the DB.
  @ApiProperty({ example: 'CREATE' })
  @Column({ type: 'varchar', length: 32 })
  action: string

  // The domain entity that was affected, e.g. 'Post', 'User', 'Tag'.
  @ApiProperty({ example: 'Post' })
  @Column({ type: 'varchar', length: 64 })
  entity: string

  // The primary key of the affected row.
  @ApiProperty({ example: 7 })
  @Column({ type: 'int' })
  entityId: number

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date

  // Transient (not a DB column) — attached by FindAllAuditLogsProvider after
  // the page is fetched. null when userId is null (no actor); a
  // { deleted: true, ...null fields } snapshot when userId is set but the
  // User row no longer exists (hard-deleted).
  @ApiPropertyOptional({ type: () => AuditLogUserSnapshot, nullable: true })
  user?: AuditLogUserSnapshot | null
}
