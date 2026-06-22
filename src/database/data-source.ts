import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { User } from 'src/users/entities/user.entity'
import { Post } from 'src/posts/entities/post.entity'
import { Tag } from 'src/tags/entities/tag.entity'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { AvatarOption } from 'src/users/entities/avatar-option.entity'

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` })

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Post, Tag, MetaOption, UploadFile, AvatarOption],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
})
