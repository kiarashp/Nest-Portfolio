import { Module } from '@nestjs/common'
import { PostsService } from './providers/posts.service'
import { PostsController } from './posts.controller'
import { UsersModule } from 'src/users/users.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Post } from './entities/post.entity'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'
import { TagsModule } from 'src/tags/tags.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { CreatePostProvider } from './providers/create-post.provider'
import { FindOnePostProvider } from './providers/find-one-post.provider'
import { FindAllPostsProvider } from './providers/find-all-posts.provider'
import { UpdatePostProvider } from './providers/update-post.provider'
import { RemovePostProvider } from './providers/remove-post.provider'
import { UploadPostImageProvider } from './providers/upload-post-image.provider'
import { UploadsModule } from 'src/uploads/uploads.module'

@Module({
  controllers: [PostsController],
  providers: [
    PostsService,
    CreatePostProvider,
    FindOnePostProvider,
    FindAllPostsProvider,
    UpdatePostProvider,
    RemovePostProvider,
    UploadPostImageProvider,
  ],
  imports: [
    UsersModule,
    TagsModule,
    PaginationModule,
    UploadsModule,
    TypeOrmModule.forFeature([Post, MetaOption]),
  ],
})
export class PostsModule {}
