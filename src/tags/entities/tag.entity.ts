import { Post } from 'src/posts/entities/post.entity'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class Tag {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number
  // name
  @ApiProperty({ example: 'TypeScript' })
  @Column({
    type: 'varchar',
    length: 256,
    nullable: false,
    unique: true,
  })
  name!: string
  // slug
  @ApiProperty({ example: 'typescript' })
  @Column({
    type: 'varchar',
    length: 256,
    nullable: false,
    unique: true,
  })
  slug!: string
  // description
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string | null
  // posts — inverse relation, never loaded on a tag response; left undecorated
  @ManyToMany(() => Post, (post) => post.tags, { onDelete: 'CASCADE' })
  posts!: Post[]
  // created at
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
  // updated at
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
  // deleted at — non-null once the tag is soft-deleted
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date
}
