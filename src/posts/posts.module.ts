import { Module } from '@nestjs/common'
import { PostsService } from './providers/posts.service'
import { PostsController } from './posts.controller'
import { UsersModule } from 'src/users/users.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Post } from './entities/post.entity'
import { TagsModule } from 'src/tags/tags.module'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { CreatePostProvider } from './providers/create-post.provider'
import { FindOnePostProvider } from './providers/find-one-post.provider'
import { FindOnePostForEditProvider } from './providers/find-one-post-for-edit.provider'
import { FindAllPostsProvider } from './providers/find-all-posts.provider'
import { FindPostBySlugProvider } from './providers/find-post-by-slug.provider'
import { UpdatePostProvider } from './providers/update-post.provider'
import { RemovePostProvider } from './providers/remove-post.provider'
import { UploadPostImageProvider } from './providers/upload-post-image.provider'
import { FindMyPostsProvider } from './providers/find-my-posts.provider'
import { ManagePostTagsProvider } from './providers/manage-post-tags.provider'
import { FindPostImagesProvider } from './providers/find-post-images.provider'
import { DeletePostImageProvider } from './providers/delete-post-image.provider'
import { UploadsModule } from 'src/uploads/uploads.module'
import { AuditLogModule } from 'src/audit-log/audit-log.module'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'

@Module({
  controllers: [PostsController],
  providers: [
    PostsService,
    CreatePostProvider,
    FindOnePostProvider,
    FindOnePostForEditProvider,
    FindAllPostsProvider,
    FindPostBySlugProvider,
    UpdatePostProvider,
    RemovePostProvider,
    UploadPostImageProvider,
    FindMyPostsProvider,
    ManagePostTagsProvider,
    FindPostImagesProvider,
    DeletePostImageProvider,
  ],
  imports: [
    UsersModule,
    TagsModule,
    PaginationModule,
    UploadsModule,
    TypeOrmModule.forFeature([Post, UploadFile]),
    AuditLogModule,
  ],
})
export class PostsModule {}
