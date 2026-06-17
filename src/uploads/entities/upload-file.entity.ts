import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { User } from 'src/users/entities/user.entity'
import { Post } from 'src/posts/entities/post.entity'
import { FileType } from '../enums/file-type.enum'

@Entity()
export class UploadFile {
  @PrimaryGeneratedColumn()
  id!: number
  // original filename
  @Column({ type: 'varchar', length: 1024, nullable: false })
  name!: string
  // cloudinary secure_url
  @Column({ type: 'varchar', length: 2048, nullable: false })
  path!: string
  // cloudinary public_id, needed later to delete/transform the asset
  @Column({ type: 'varchar', length: 256, nullable: false })
  publicId!: string
  // file type
  @Column({
    type: 'enum',
    enum: FileType,
    nullable: false,
    default: FileType.IMAGE,
  })
  type!: FileType
  // mimetype
  @Column({ type: 'varchar', length: 128, nullable: false })
  mime!: string
  // size
  @Column({ type: 'int', nullable: false })
  size!: number
  // user id
  @Column({ type: 'int', nullable: false })
  userId!: number
  // user
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User
  // post id — null for uploads not tied to a post (e.g. avatars)
  @Column({ type: 'int', nullable: true })
  postId?: number
  // post
  @ManyToOne(() => Post, (post) => post.uploadFiles, { nullable: true })
  @JoinColumn({ name: 'postId' })
  post?: Post
  // created at
  @CreateDateColumn()
  createdAt!: Date
  // updated at
  @UpdateDateColumn()
  updatedAt!: Date
}
