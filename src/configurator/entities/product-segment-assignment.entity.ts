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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ConfigurableProduct } from './configurable-product.entity'
import { SegmentDefinition } from './segment-definition.entity'

// Describes when an assignment's segment is ACTIVE: if the controlling
// assignment (by id, at a strictly lower position in the same product)
// meets the comparison, the segment is active; otherwise it is zero-filled.
// A segment with no condition is always active. Max one condition per
// assignment — chains already express compound dependency.
export interface AssignmentCondition {
  controllingAssignmentId: number
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'between'
  value?: string
  min?: number
  max?: number
  effect: 'zero_fill'
}

// Places a SegmentDefinition at a position inside one ConfigurableProduct,
// optionally guarded by a condition on an earlier assignment in the same
// product. Join entity between ConfigurableProduct and SegmentDefinition.
@Entity('configurator_assignment')
@Unique(['productId', 'position'])
@Unique(['productId', 'definitionId'])
export class ProductSegmentAssignment {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // product — the ConfigurableProduct this position belongs to; deleting
  // the product deletes its assignments
  @ApiProperty({ type: () => ConfigurableProduct })
  @ManyToOne(() => ConfigurableProduct, (product) => product.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product!: ConfigurableProduct

  // productId — FK column used for filtering/uniqueness without loading
  // the relation
  @ApiProperty({ example: 1 })
  @Column({ nullable: false })
  productId!: number

  // definition — the segment definition placed at this position; a
  // definition in use cannot be deleted (RESTRICT)
  @ApiProperty({ type: () => SegmentDefinition })
  @ManyToOne(() => SegmentDefinition, (definition) => definition.assignments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'definitionId' })
  definition!: SegmentDefinition

  // definitionId — FK column used for filtering/uniqueness without loading
  // the relation
  @ApiProperty({ example: 1 })
  @Column({ nullable: false })
  definitionId!: number

  // position — 1-based, gapless per product, maintained server-side
  @ApiProperty({ example: 1 })
  @Column({ type: 'int', nullable: false })
  position!: number

  // condition — optional rule that zero-fills this segment when not met;
  // see AssignmentCondition. Null means always active.
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Zero-fill rule keyed on an earlier assignment in the same product',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  condition?: AssignmentCondition | null

  // createdAt
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date

  // updatedAt
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
}
