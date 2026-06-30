import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PostStatus } from '../enums/postStatus.enum'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'
import { User } from 'src/users/entities/user.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { PublicAuthor } from 'src/users/dto/public-author.dto'

@Entity()
export class Post {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number
  // title
  @ApiProperty({ example: 'My first post' })
  @Column({
    type: 'varchar',
    length: 512,
    nullable: false,
  })
  title!: string
  //   slug
  @ApiProperty({ example: 'my-first-post' })
  @Column({
    type: 'varchar',
    length: 256,
    nullable: false,
    unique: true,
  })
  slug!: string
  //   status
  @ApiProperty({ enum: PostStatus, example: PostStatus.PUBLISHED })
  @Column({
    type: 'enum',
    enum: PostStatus,
    nullable: false,
    default: PostStatus.DRAFT,
  })
  status!: PostStatus
  //   content — opaque plain-text body; format is whatever the editor writes
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'text',
    nullable: true,
  })
  content?: string
  //   schema
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'text',
    nullable: true,
  })
  schema?: string
  //   featuredImage — nullable so it can be explicitly cleared (e.g. when the
  //   image it points at is deleted via DELETE /posts/:id/images/:fileId)
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  featuredImage?: string | null
  //   publishOn
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  publishOn?: Date
  //   metaOptions
  @ApiPropertyOptional({ type: () => MetaOption, nullable: true })
  @OneToOne(() => MetaOption, (metaOption) => metaOption.post, {
    cascade: true,
    eager: true,
  })
  metaOptions?: MetaOption | null
  // author — only the public author fields are serialized into post responses
  @ApiProperty({ type: () => PublicAuthor })
  @ManyToOne(() => User, (user) => user.post, { eager: true })
  author!: User
  //   tags
  @ApiPropertyOptional({ type: () => [Tag] })
  @ManyToMany(() => Tag, (tag) => tag.posts, { eager: true })
  @JoinTable()
  tags?: Tag[]
  // images uploaded for this post — not eager, only loaded when needed (e.g. on
  // delete). Intentionally not decorated with @ApiProperty: it never appears on
  // a normal post read (images come from GET /posts/:id/images).
  @OneToMany(() => UploadFile, (uploadFile) => uploadFile.post)
  uploadFiles?: UploadFile[]
  // timestamp set automatically by TypeORM when the row is first inserted
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
}
