import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Product } from './product.entity'
import { FilterableFieldDto } from '../dto/create-product-type.dto'

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
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // name — must be unique across all product types
  @ApiProperty({ example: 'Thermocouple' })
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  name!: string

  // slug — used in URLs, must be unique
  @ApiProperty({ example: 'thermocouple' })
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  slug!: string

  // filterableFields — drives the filter UI; each entry describes one filterable facet
  @ApiPropertyOptional({
    type: () => [FilterableFieldDto],
    description: 'Filter facets the frontend renders for this type',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  filterableFields?: FilterableField[] | null

  // products — inverse side; not eager to avoid loading all products on type lookup
  @OneToMany(() => Product, (product) => product.productType)
  products?: Product[]

  // productCount — transient (not a DB column); number of published products in
  // this type, populated by FindAllProductTypesProvider for the landing cards.
  @ApiPropertyOptional({
    description: 'Number of published products in this type',
    example: 24,
  })
  productCount?: number

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
}
