import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// A configurable product family the admin defines (e.g. "Resistive sensor
// with cap", code prefix "FRH"). Customers compose an ordering code for it
// position by position via the resolver. Fully separate from the existing
// products module's Product/ProductType entities.
@Entity('configurator_product')
export class ConfigurableProduct {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // name — admin- and customer-facing, must be unique
  @ApiProperty({ example: 'Resistive sensor with cap' })
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  name!: string

  // slug — public URL slug, client-supplied (project convention: no auto-slugify)
  @ApiProperty({ example: 'resistive-sensor-with-cap' })
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  slug!: string

  // codePrefix — static string, always the first token of the composed code
  @ApiProperty({ example: 'FRH' })
  @Column({ type: 'varchar', length: 32, nullable: false })
  codePrefix!: string

  // separator — joins code tokens; not exposed in admin DTOs yet, column
  // exists for the future
  @ApiProperty({ example: '-' })
  @Column({ type: 'varchar', length: 1, nullable: false, default: '-' })
  separator!: string

  // description — public page copy
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null

  // imageUrl — Cloudinary secure URL
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'varchar', length: 1024, nullable: true })
  imageUrl?: string | null

  // imagePublicId — Cloudinary public id, stored so the asset can be
  // destroyed on replace/delete
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'varchar', length: 256, nullable: true })
  imagePublicId?: string | null

  // isPublished — unpublished products are invisible on public endpoints (404)
  @ApiProperty({ example: false })
  @Column({ type: 'boolean', default: false, nullable: false })
  isPublished!: boolean

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date

  // deletedAt — soft delete; non-null means the product has been removed.
  // The Cloudinary image is kept on soft-delete, same spirit as products
  // keeping their UploadFiles.
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date | null
}
