import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class Tag {
  // id
  @PrimaryGeneratedColumn()
  id!: number
  // name
  @Column({
    type: 'varchar',
    length: 256,
    nullable: false,
    unique: true,
  })
  name!: string
  // slug
  @Column({
    type: 'varchar',
    length: 256,
    nullable: false,
    unique: true,
  })
  slug!: string
  // description
  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string | null
  @Column({
    type: 'text',
    nullable: true,
  })
  // schema
  schema?: string | null
  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  // featured image
  featuredImage?: string | null
  // created at
  @CreateDateColumn()
  createdAt!: Date
  // updated at
  @UpdateDateColumn()
  updatedAt!: Date
  // deleted at
  @DeleteDateColumn()
  deletedAt?: Date
}
