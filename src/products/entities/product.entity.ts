import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ProductType } from './product-type.entity'

@Entity()
@Index(['productTypeId'])
export class Product {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // name
  @ApiProperty({ example: 'Type K Thermocouple' })
  @Column({ type: 'varchar', length: 512, nullable: false })
  name!: string

  // slug — used in public URLs; must be unique
  @ApiProperty({ example: 'type-k-thermocouple' })
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  slug!: string

  // sku — optional vendor/internal code; unique when present
  @ApiPropertyOptional({
    type: String,
    example: 'TC-K-1260-IC',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  sku?: string | null

  // shortDescription — shown on list cards and search results
  @ApiProperty({ example: 'High-accuracy thermocouple for industrial use' })
  @Column({ type: 'varchar', length: 512, nullable: false })
  shortDescription!: string

  // description — full detail body shown on the product page
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null

  // imageUrl — main Cloudinary image (set via the /image upload endpoint)
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'varchar', length: 1024, nullable: true })
  imageUrl?: string | null

  // images — gallery of additional Cloudinary URLs
  @ApiPropertyOptional({ type: [String], nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  images?: string[] | null

  // specs — type-specific attribute values stored as jsonb; keys must match
  // filterableFields[].key on the product's ProductType. Filtered at query time
  // via jsonb containment (enum/string) and numeric range casts (number). No
  // index here: at this catalog's scale a sequential scan is fine. To index spec
  // filtering in production, add a GIN index via a migration — TypeORM's @Index
  // decorator cannot express `USING gin`, so it must be raw SQL:
  //   CREATE INDEX idx_product_specs_gin ON product USING gin (specs)
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Type-specific attribute values; keys match the type filterableFields',
    example: { tempRange: 1260, sheathMaterial: 'Inconel 600' },
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  specs?: Record<string, unknown> | null

  // isPublished — false by default; set to true to make the product visible to the public
  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: false, nullable: false })
  isPublished!: boolean

  // productType — the category this product belongs to (eager so callers always get type data)
  @ApiProperty({ type: () => ProductType })
  @ManyToOne(() => ProductType, (pt) => pt.products, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'productTypeId' })
  productType!: ProductType

  // productTypeId — FK column used for filtering without loading the relation
  @ApiProperty({ example: 1 })
  @Column({ nullable: false })
  productTypeId!: number

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date

  // deletedAt — soft delete; non-null means the product has been removed
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date | null
}
