import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { PostType } from '../enums/postType.enum'
import { PostStatus } from '../enums/postStatus.enum'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'
import { User } from 'src/users/entities/user.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'

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
  //   metaOptions
  @OneToOne(() => MetaOption, (metaOption) => metaOption.post, {
    cascade: true,
    eager: true,
  })
  metaOptions?: MetaOption | null
  // author
  @ManyToOne(() => User, (user) => user.post, { eager: true })
  author!: User
  //   tags
  @ManyToMany(() => Tag, (tag) => tag.posts, { eager: true })
  @JoinTable()
  tags?: Tag[]
  // images uploaded for this post — not eager, only loaded when needed (e.g. on delete)
  @OneToMany(() => UploadFile, (uploadFile) => uploadFile.post)
  uploadFiles?: UploadFile[]
}
