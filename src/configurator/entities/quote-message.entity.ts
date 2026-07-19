import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Exclude } from 'class-transformer'
import { User } from 'src/users/entities/user.entity'
import { SavedConfiguration } from './saved-configuration.entity'
import { QuoteMessageSenderRole } from '../enums/quote-message-sender-role.enum'

// One message in the ticket-style thread attached to a quote request. Each
// SavedConfiguration with quoteRequestedAt set has exactly one thread — the
// messages hang directly off the snapshot, there is no separate thread
// entity. Messages are immutable once posted (no updatedAt, no edit route).
// The composite index serves both the thread fetch (by parent, ordered by
// createdAt) and the unread count (parent + createdAt cutoff).
@Entity('configurator_quote_message')
@Index(['savedConfigurationId', 'createdAt'])
export class QuoteMessage {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // savedConfigurationId — the owning quote-request thread; messages are
  // removed when the snapshot is deleted (ON DELETE CASCADE)
  @ApiProperty({ example: 1 })
  @Column({ type: 'int', nullable: false })
  savedConfigurationId!: number

  // savedConfiguration — relation, never serialized into responses
  @Exclude()
  @ManyToOne(() => SavedConfiguration, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'savedConfigurationId' })
  savedConfiguration!: SavedConfiguration

  // senderId — who wrote the message; nullable with SET NULL (not CASCADE)
  // so deleting an admin account does not delete their replies out of users'
  // threads. The denormalized senderRole below keeps the thread renderable
  // after the sender is gone. (Owner deletion still removes the whole thread
  // via the savedConfiguration CASCADE.)
  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  @Column({ type: 'int', nullable: true })
  senderId?: number | null

  // sender — relation, never serialized into responses
  @Exclude()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'senderId' })
  sender?: User | null

  // senderRole — which side of the thread wrote this message; the frontend
  // aligns bubbles on it and the unread count filters on it
  @ApiProperty({
    enum: QuoteMessageSenderRole,
    example: QuoteMessageSenderRole.USER,
  })
  @Column({ type: 'enum', enum: QuoteMessageSenderRole, nullable: false })
  senderRole!: QuoteMessageSenderRole

  // body — the message text, plain text
  @ApiProperty({ example: 'Could you quote 50 units of this configuration?' })
  @Column({ type: 'text', nullable: false })
  body!: string

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
}
