import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PostStatus } from '../enums/postStatus.enum'
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
  //   isFeatured — surfaces the post in a featured/highlighted section
  @ApiProperty({ example: false })
  @Column({
    type: 'boolean',
    default: false,
    nullable: false,
  })
  isFeatured!: boolean
  //   content — opaque plain-text body; format is whatever the editor writes
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'text',
    nullable: true,
  })
  content?: string
  //   contentHtml — sanitized HTML rendered from `content` at write time so
  //   clients don't need their own markdown parser/sanitizer. Never
  //   client-settable: absent from CreatePostDto/PatchPostDto, so
  //   forbidNonWhitelisted rejects any attempt to set it directly.
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'text',
    nullable: true,
  })
  contentHtml?: string | null
  //   excerpt — short plain-text summary; used as the SEO meta description /
  //   OG description, capped at the conventional 160-character length
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  excerpt?: string
  //   featuredImage — nullable so it can be explicitly cleared (e.g. when the
  //   image it points at is deleted via DELETE /posts/:id/images/:fileId)
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  featuredImage?: string | null
  //   images — curated gallery of additional Cloudinary URLs, a subset of the
  //   files uploaded via POST /posts/:id/images (which lists every uploaded
  //   file, not just the ones chosen for the gallery)
  @ApiPropertyOptional({ type: [String], nullable: true })
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  images?: string[] | null
  //   publishOn
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  publishOn?: Date
  //   publishedAt — stamped automatically the moment status becomes PUBLISHED;
  //   never settable via any DTO. Nullable because draft/scheduled/review
  //   posts have none.
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  publishedAt?: Date
  // author — only the public author fields are serialized into post responses
  @ApiProperty({ type: () => PublicAuthor })
  @ManyToOne(() => User, (user) => user.post, { eager: true })
  author!: User
  //   tags
  @ApiPropertyOptional({ type: () => [Tag] })
  @ManyToMany(() => Tag, (tag) => tag.posts, { eager: true })
  @JoinTable()
  tags?: Tag[]
  // uploadFiles — every file ever uploaded for this post, not eager, only
  // loaded when needed (e.g. on delete). Intentionally not decorated with
  // @ApiProperty: it never appears on a normal post read (the full list comes
  // from GET /posts/:id/images; the curated subset is the `images` column above).
  @OneToMany(() => UploadFile, (uploadFile) => uploadFile.post)
  uploadFiles?: UploadFile[]
  // timestamp set automatically by TypeORM when the row is first inserted
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
}
