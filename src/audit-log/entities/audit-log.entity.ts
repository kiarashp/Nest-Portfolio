import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

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
}
