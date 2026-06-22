import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity()
export class AvatarOption {
  @PrimaryGeneratedColumn()
  id!: number

  // Cloudinary secure_url — written to user.avatarUrl when this option is selected
  @Column({ type: 'varchar', length: 2048, nullable: false })
  url!: string

  // Cloudinary public_id — needed to delete the asset when this option is removed
  @Column({ type: 'varchar', length: 256, nullable: false })
  publicId!: string

  @CreateDateColumn()
  createdAt!: Date
}
