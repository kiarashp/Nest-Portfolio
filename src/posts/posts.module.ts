import { Module } from '@nestjs/common'
import { PostsService } from './providers/posts.service'
import { PostsController } from './posts.controller'
import { UsersModule } from 'src/users/users.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Post } from './entities/post.entity'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'

@Module({
  controllers: [PostsController],
  providers: [PostsService],
  imports: [UsersModule, TypeOrmModule.forFeature([Post, MetaOption])],
})
export class PostsModule {}
