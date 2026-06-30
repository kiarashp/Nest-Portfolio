import { ApiProperty } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity()
export class AvatarOption {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number

  // Cloudinary secure_url — written to user.avatarUrl when this option is selected
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/avatar.png',
  })
  @Column({ type: 'varchar', length: 2048, nullable: false })
  url!: string

  // Cloudinary public_id — needed to delete the asset when this option is removed
  @ApiProperty({ example: 'avatars/abc123' })
  @Column({ type: 'varchar', length: 256, nullable: false })
  publicId!: string

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
}
