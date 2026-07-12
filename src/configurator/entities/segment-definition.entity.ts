import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { SegmentOption } from './segment-option.entity'
import { ProductSegmentAssignment } from './product-segment-assignment.entity'

// Constraints shape for dataType = STRING.
export interface StringConstraints {
  minLength: number
  maxLength: number
  pattern?: string
}

// Constraints shape for dataType = NUMBER. Values are rendered as a
// zero-padded string of exactly `digits` characters.
export interface NumberConstraints {
  digits: number
  min: number
  max: number
}

// dataType = SELECT carries no constraints — its allowed values live in
// SegmentOption rows instead.
export type SegmentConstraints =
  | StringConstraints
  | NumberConstraints
  | Record<string, never>

// A reusable field definition in the admin's shared segment library (e.g.
// "Sensor type (1m/2m/1d/2d)"). Defined once, assignable to many
// ConfigurableProducts via ProductSegmentAssignment. Label, values, and
// meanings are identical everywhere a definition is used — there are no
// per-product overrides.
@Entity('configurator_segment_definition')
export class SegmentDefinition {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // name — admin-facing library name, must be unique
  @ApiProperty({ example: 'Sensor type (1m/2m/1d/2d)' })
  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  name!: string

  // label — customer-facing question shown on the configurator form
  @ApiProperty({ example: 'Sensor type' })
  @Column({ type: 'varchar', length: 256, nullable: false })
  label!: string

  // dataType — determines the shape of `constraints` and which condition
  // operators may target this definition
  @ApiProperty({ enum: SegmentDataType, example: SegmentDataType.SELECT })
  @Column({ type: 'enum', enum: SegmentDataType, nullable: false })
  dataType!: SegmentDataType

  // constraints — shape depends on dataType (see StringConstraints /
  // NumberConstraints); empty/ignored for SELECT. Per-type validation of
  // this jsonb happens in the provider layer added in Step 2.
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Shape depends on dataType — see StringConstraints/NumberConstraints',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  constraints?: SegmentConstraints | null

  // meaningTemplate — human summary line rendered by the resolver, e.g.
  // "Insertion length: {value} mm" or "Sensor: {label}"
  @ApiProperty({ example: 'Sensor: {label}' })
  @Column({ type: 'varchar', length: 512, nullable: false })
  meaningTemplate!: string

  // options — inverse side of SegmentOption; only meaningful for SELECT
  // definitions, not eager to avoid loading options on every lookup.
  // FindOneSegmentDefinitionProvider always loads it explicitly, so it is
  // genuinely present on GET /configurator-definitions/:id — decorated so
  // that response is actually typed instead of silently missing the field.
  @ApiPropertyOptional({ type: () => SegmentOption, isArray: true })
  @OneToMany(() => SegmentOption, (option) => option.definition)
  options?: SegmentOption[]

  // assignments — inverse side of ProductSegmentAssignment; every product
  // position that uses this definition, not eager. Left undecorated: unlike
  // `options`, nothing loads it for a definition-scoped read, so it would
  // always render as an empty/undefined array if typed.
  @OneToMany(
    () => ProductSegmentAssignment,
    (assignment) => assignment.definition,
  )
  assignments?: ProductSegmentAssignment[]

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
}
