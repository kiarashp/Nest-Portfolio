import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { User } from 'src/users/entities/user.entity'
import { Post } from 'src/posts/entities/post.entity'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { FileType } from '../enums/file-type.enum'

@Entity()
export class UploadFile {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number
  // original filename
  @ApiProperty({ example: 'photo.jpg' })
  @Column({ type: 'varchar', length: 1024, nullable: false })
  name!: string
  // cloudinary secure_url
  @ApiProperty({ example: 'https://res.cloudinary.com/.../photo.jpg' })
  @Column({ type: 'varchar', length: 2048, nullable: false })
  path!: string
  // cloudinary public_id, needed later to delete/transform the asset
  @ApiProperty({ example: 'posts/12/photo' })
  @Column({ type: 'varchar', length: 256, nullable: false })
  publicId!: string
  // file type
  @ApiProperty({ enum: FileType, example: FileType.IMAGE })
  @Column({
    type: 'enum',
    enum: FileType,
    nullable: false,
    default: FileType.IMAGE,
  })
  type!: FileType
  // mimetype
  @ApiProperty({ example: 'image/jpeg' })
  @Column({ type: 'varchar', length: 128, nullable: false })
  mime!: string
  // size
  @ApiProperty({ example: 204800 })
  @Column({ type: 'int', nullable: false })
  size!: number
  // user id
  @ApiProperty({ example: 1 })
  @Column({ type: 'int', nullable: false })
  userId!: number
  // user — relation, not serialized into the images response; left undecorated
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User
  // post id — null for uploads not tied to a post (e.g. avatars)
  @ApiPropertyOptional({ example: 12, nullable: true })
  @Column({ type: 'int', nullable: true })
  postId?: number
  // post — relation, not serialized into the images response; left undecorated
  @ManyToOne(() => Post, (post) => post.uploadFiles, { nullable: true })
  @JoinColumn({ name: 'postId' })
  post?: Post
  // product id — null for uploads not tied to a product. A row links to a post,
  // a product, or a product type (or none, e.g. avatars) — never more than one.
  @ApiPropertyOptional({ example: 7, nullable: true })
  @Column({ type: 'int', nullable: true })
  productId?: number
  // product — relation, not serialized into the images response; left undecorated
  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product
  // product type id — null for uploads not tied to a product type
  @ApiPropertyOptional({ example: 3, nullable: true })
  @Column({ type: 'int', nullable: true })
  productTypeId?: number
  // product type — relation, not serialized into the images response; left undecorated
  @ManyToOne(() => ProductType, { nullable: true })
  @JoinColumn({ name: 'productTypeId' })
  productType?: ProductType
  // created at
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
  // updated at
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
}
