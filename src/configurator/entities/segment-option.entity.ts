import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'
import { SegmentDefinition } from './segment-definition.entity'

// One allowed value + its human meaning for a SELECT SegmentDefinition
// (e.g. value "2d" -> label "double Pt500"). The value "0" is reserved as
// the universal zero-fill marker and is rejected at admin time.
@Entity('configurator_segment_option')
@Unique(['definitionId', 'value'])
export class SegmentOption {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // definition — the SELECT definition this option belongs to; deleting the
  // definition deletes its options
  @ApiProperty({ type: () => SegmentDefinition })
  @ManyToOne(() => SegmentDefinition, (definition) => definition.options, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'definitionId' })
  definition!: SegmentDefinition

  // definitionId — FK column used for filtering/uniqueness without loading
  // the relation
  @ApiProperty({ example: 1 })
  @Column({ nullable: false })
  definitionId!: number

  // value — what goes into the composed code, e.g. "2d". Unique per
  // definition, never "0"
  @ApiProperty({ example: '2d' })
  @Column({ type: 'varchar', length: 64, nullable: false })
  value!: string

  // label — human meaning shown in the dropdown, e.g. "double Pt500"
  @ApiProperty({ example: 'double Pt500' })
  @Column({ type: 'varchar', length: 256, nullable: false })
  label!: string

  // sortOrder — display order in the dropdown
  @ApiProperty({ example: 0 })
  @Column({ type: 'int', nullable: false, default: 0 })
  sortOrder!: number

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
}
