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
import { ProductType } from './product-type.entity'

@Entity()
@Index(['productTypeId'])
export class Product {
  // id
  @PrimaryGeneratedColumn()
  id!: number

  // name
  @Column({ type: 'varchar', length: 512, nullable: false })
  name!: string

  // slug — used in public URLs; must be unique
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  slug!: string

  // sku — optional vendor/internal code; unique when present
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  sku?: string | null

  // shortDescription — shown on list cards and search results
  @Column({ type: 'varchar', length: 512, nullable: false })
  shortDescription!: string

  // description — full detail body shown on the product page
  @Column({ type: 'text', nullable: true })
  description?: string | null

  // imageUrl — main Cloudinary image (set via the /image upload endpoint)
  @Column({ type: 'varchar', length: 1024, nullable: true })
  imageUrl?: string | null

  // images — gallery of additional Cloudinary URLs
  @Column({ type: 'jsonb', nullable: true })
  images?: string[] | null

  // specs — type-specific attribute values stored as jsonb; keys must match
  // filterableFields[].key on the product's ProductType. Filtered at query time
  // via jsonb containment (enum/string) and numeric range casts (number). No
  // index here: at this catalog's scale a sequential scan is fine. To index spec
  // filtering in production, add a GIN index via a migration — TypeORM's @Index
  // decorator cannot express `USING gin`, so it must be raw SQL:
  //   CREATE INDEX idx_product_specs_gin ON product USING gin (specs)
  @Column({ type: 'jsonb', nullable: true })
  specs?: Record<string, unknown> | null

  // isPublished — false by default; set to true to make the product visible to the public
  @Column({ type: 'boolean', default: false, nullable: false })
  isPublished!: boolean

  // productType — the category this product belongs to (eager so callers always get type data)
  @ManyToOne(() => ProductType, (pt) => pt.products, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'productTypeId' })
  productType!: ProductType

  // productTypeId — FK column used for filtering without loading the relation
  @Column({ nullable: false })
  productTypeId!: number

  // createdAt
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @UpdateDateColumn()
  updatedAt!: Date

  // deletedAt — soft delete; non-null means the product has been removed
  @DeleteDateColumn()
  deletedAt?: Date | null
}
