import { Exclude } from 'class-transformer'
import { Post } from 'src/posts/entities/post.entity'
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'

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
  // posts
  @OneToMany(() => Post, (post) => post.author)
  post!: Post[]
}
