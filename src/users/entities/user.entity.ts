import { Exclude, Expose } from 'class-transformer'
import { Post } from 'src/posts/entities/post.entity'
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Entity()
export class User {
  // Id
  @PrimaryGeneratedColumn()
  id!: number
  //   First name
  @Column({
    type: 'varchar',
    length: 96,
    nullable: false,
  })
  firstName!: string
  //   Last name
  @Column({
    type: 'varchar',
    length: 96,
    nullable: true,
  })
  lastName!: string | null
  //   Email
  @Column({
    type: 'varchar',
    length: 96,
    nullable: false,
    unique: true,
  })
  // only included in responses when the 'admin' serialization group is active
  @Expose({ groups: ['admin'] })
  email!: string
  //   Password
  @Column({
    type: 'varchar',
    length: 96,
    nullable: true,
  })
  @Exclude()
  password?: string
  // google id
  @Column({
    type: 'varchar',
    nullable: true,
  })
  @Exclude()
  googleId?: string
  // cloudinary secure_url of the user's avatar, null until the user uploads one
  @Column({
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  avatarUrl?: string
  // role — controls what the user is allowed to do
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  // only included in responses when the 'admin' serialization group is active
  @Expose({ groups: ['admin'] })
  role!: UserRole
  // only included in responses when the 'admin' serialization group is active
  @Expose({ groups: ['admin'] })
  @Column({ type: 'boolean', default: false })
  isEmailVerified!: boolean
  @Column({ type: 'varchar', length: 128, nullable: true, default: null })
  @Exclude()
  emailVerificationToken?: string | null
  @Column({ type: 'timestamptz', nullable: true, default: null })
  @Exclude()
  emailVerificationTokenExpiry?: Date | null
  @Column({ type: 'varchar', length: 128, nullable: true, default: null })
  @Exclude()
  passwordResetToken?: string | null
  @Column({ type: 'timestamptz', nullable: true, default: null })
  @Exclude()
  passwordResetTokenExpiry?: Date | null
  // posts
  @OneToMany(() => Post, (post) => post.author)
  post!: Post[]
}
