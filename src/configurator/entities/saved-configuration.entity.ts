import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Exclude } from 'class-transformer'
import { User } from 'src/users/entities/user.entity'
import { ConfigurableProduct } from './configurable-product.entity'
import { SavedConfigurationRequester } from '../dtos/saved-configuration-requester.dto'
import { QuoteStatus } from '../enums/quote-status.enum'

// A frozen snapshot of a resolved configuration owned by a registered user
// (CONFIGURATOR.md §2.5). The snapshot is never re-resolved against live
// config — admin edits to definitions/products after saving have zero effect
// on saved rows. No soft delete: only ConfigurableProduct soft-deletes.
@Entity('configurator_saved_configuration')
export class SavedConfiguration {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // userId — the owning registered user; rows are removed when the user is
  // deleted (ON DELETE CASCADE)
  @ApiProperty({ example: 1 })
  @Column({ type: 'int', nullable: false })
  userId!: number

  // user — relation, never serialized into responses; left undecorated so it
  // stays out of the OpenAPI schema (same as UploadFile.user). The admin
  // providers below now load it via join to populate `requester`, so
  // @Exclude() is required here to keep the raw entity out of the JSON body.
  @Exclude()
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  // productId — kept for listing/filtering only; nullable so the snapshot
  // survives a hard product deletion (ON DELETE SET NULL)
  @ApiPropertyOptional({ type: Number, example: 3, nullable: true })
  @Column({ type: 'int', nullable: true })
  productId?: number | null

  // product — relation, never serialized into responses; left undecorated
  @ManyToOne(() => ConfigurableProduct, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'productId' })
  product?: ConfigurableProduct | null

  // productName — snapshot of the product name at save time
  @ApiProperty({ example: 'Resistive sensor with cap' })
  @Column({ type: 'varchar', length: 256, nullable: false })
  productName!: string

  // code — snapshot of the full composed ordering code
  @ApiProperty({ example: 'FRH-2d-no-00-000-0450' })
  @Column({ type: 'varchar', length: 512, nullable: false })
  code!: string

  // summary — snapshot of the rendered human summary lines (one per active
  // segment; zero-filled segments were omitted by the resolver)
  @ApiProperty({
    type: [String],
    example: ['Sensor: double Pt500', 'Insertion length: 450 mm'],
  })
  @Column({ type: 'jsonb', nullable: false })
  summary!: string[]

  // selections — snapshot of the raw selections map the user submitted, kept
  // for reference only (the code/summary above are the authoritative result)
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { '11': '2d', '12': 'no', '15': '450' },
  })
  @Column({ type: 'jsonb', nullable: false })
  selections!: Record<string, string>

  // quoteRequestedAt — set when the user requests a quote for this snapshot
  // (Step 7 endpoint); null until then
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  quoteRequestedAt?: Date | null

  // quoteStatus — lifecycle status of the quote request. Null until a quote
  // is requested (invariant: quoteStatus IS NULL exactly when
  // quoteRequestedAt IS NULL); set to PENDING in the same save that stamps
  // quoteRequestedAt. A user message always moves it back to PENDING; an
  // admin message moves PENDING to ANSWERED (CLOSED stays closed); the admin
  // PATCH can set any value.
  @ApiPropertyOptional({ enum: QuoteStatus, nullable: true })
  @Column({ type: 'enum', enum: QuoteStatus, nullable: true })
  quoteStatus?: QuoteStatus | null

  // userLastReadAt — when the owner last fetched the message thread; a
  // message from the admin newer than this counts as unread for the owner
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  userLastReadAt?: Date | null

  // adminLastReadAt — when an admin last fetched the message thread; shared
  // by all admins (single-owner site), same unread semantics as above
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  adminLastReadAt?: Date | null

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date

  // requester — transient, not a stored column. Populated only by the admin
  // inbox providers (list + single-read) from the joined user relation,
  // mirroring the ProductType.productCount / Product.related pattern of a
  // computed field that's undefined unless the serving endpoint opts in.
  @ApiPropertyOptional({ type: () => SavedConfigurationRequester })
  requester?: SavedConfigurationRequester

  // unreadCount — transient, not a stored column. Number of messages from
  // the other side newer than the reader's last-read timestamp; populated
  // only by the list providers (owner list counts admin messages, admin
  // inbox counts user messages).
  @ApiPropertyOptional({ type: Number })
  unreadCount?: number
}
