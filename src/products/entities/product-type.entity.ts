import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Product } from './product.entity'

/** Describes one facet shown in the product filter UI for this type. */
export interface FilterableField {
  key: string
  label: string
  type: 'number' | 'enum' | 'string'
  unit?: string
  /** Only meaningful when type is 'enum'. */
  options?: string[]
}

@Entity()
export class ProductType {
  // id
  @PrimaryGeneratedColumn()
  id!: number

  // name — must be unique across all product types
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  name!: string

  // slug — used in URLs, must be unique
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  slug!: string

  // filterableFields — drives the filter UI; each entry describes one filterable facet
  @Column({ type: 'jsonb', nullable: true })
  filterableFields?: FilterableField[] | null

  // products — inverse side; not eager to avoid loading all products on type lookup
  @OneToMany(() => Product, (product) => product.productType)
  products?: Product[]

  // createdAt
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @UpdateDateColumn()
  updatedAt!: Date
}
