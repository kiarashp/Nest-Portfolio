import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number

  // The user who performed the action; null when the actor is anonymous (e.g. self-registration).
  @Column({ type: 'int', nullable: true })
  userId: number | null

  // One of CREATE, UPDATE, DELETE, SOFT_DELETE — stored as a plain string to keep the
  // table readable without joining to an enum type in the DB.
  @Column({ type: 'varchar', length: 32 })
  action: string

  // The domain entity that was affected, e.g. 'Post', 'User', 'Tag'.
  @Column({ type: 'varchar', length: 64 })
  entity: string

  // The primary key of the affected row.
  @Column({ type: 'int' })
  entityId: number

  @CreateDateColumn()
  createdAt: Date
}
