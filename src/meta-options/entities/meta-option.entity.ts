import { Post } from 'src/posts/entities/post.entity'
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
  @PrimaryGeneratedColumn()
  id!: number
  // meta value
  @Column({
    type: 'json',
    nullable: false,
  })
  metaValue!: string
  // create date
  @CreateDateColumn()
  createDate!: Date
  // update date
  @UpdateDateColumn()
  updateDate!: Date
  // post
  @OneToOne(() => Post, (post) => post.metaOptions, { onDelete: 'CASCADE' })
  @JoinColumn()
  post!: Post
}
