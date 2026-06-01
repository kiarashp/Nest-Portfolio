import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { PostType } from '../enums/postType.enum'
import { PostStatus } from '../enums/postStatus.enum'
import { CreatePostMetaOptionsDto } from '../dto/create-post-meta-options.dto'

@Entity()
export class Post {
  // id
  @PrimaryGeneratedColumn()
  id!: number
  // title
  @Column({
    type: 'varchar',
    length: 512,
    nullable: false,
  })
  title!: string
  //   postType
  @Column({
    type: 'enum',
    enum: PostType,
    nullable: false,
    default: PostType.POST,
  })
  postType!: PostType
  //   slug
  @Column({
    type: 'varchar',
    length: 256,
    nullable: false,
    unique: true,
  })
  slug!: string
  //   status
  @Column({
    type: 'enum',
    enum: PostStatus,
    nullable: false,
    default: PostStatus.DRAFT,
  })
  status!: PostStatus
  //   content
  @Column({
    type: 'text',
    nullable: true,
  })
  content?: string
  //   schema
  @Column({
    type: 'text',
    nullable: true,
  })
  schema?: string
  //   featuredImage
  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  featuredImage?: string
  //   publishOn
  @Column({
    type: 'timestamp', // equal to 'datetime in mysql'
    nullable: true,
  })
  publishOn?: Date
  //   tags
  tags?: string[]
  //   metaOptions
  metaOptions?: CreatePostMetaOptionsDto[]
}
