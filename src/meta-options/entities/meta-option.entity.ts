import { Post } from 'src/posts/entities/post.entity'
import { ApiProperty } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class MetaOption {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number
  // meta value — arbitrary JSON metadata attached to the post
  @ApiProperty({ example: '{ "sidebar": true }' })
  @Column({
    type: 'json',
    nullable: false,
  })
  metaValue!: string
  // create date
  @ApiProperty()
  @CreateDateColumn()
  createDate!: Date
  // update date
  @ApiProperty()
  @UpdateDateColumn()
  updateDate!: Date
  // post — owning back-reference; left undecorated to avoid a Post/MetaOption
  // schema cycle and because it is never serialized into a meta-option response
  @OneToOne(() => Post, (post) => post.metaOptions, { onDelete: 'CASCADE' })
  @JoinColumn()
  post!: Post
}
