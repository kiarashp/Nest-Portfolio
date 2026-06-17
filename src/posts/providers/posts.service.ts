import { Injectable } from '@nestjs/common'
import { CreatePostDto } from '../dto/create-post.dto'
import { PatchPostDto } from '../dto/update-post.dto'
import { GetPostsDto } from '../dto/get-posts.dto'
import { Post } from '../entities/post.entity'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { CreatePostProvider } from './create-post.provider'
import { FindOnePostProvider } from './find-one-post.provider'
import { FindAllPostsProvider } from './find-all-posts.provider'
import { FindPostBySlugProvider } from './find-post-by-slug.provider'
import { UpdatePostProvider } from './update-post.provider'
import { RemovePostProvider } from './remove-post.provider'
import { UploadPostImageProvider } from './upload-post-image.provider'

@Injectable()
export class PostsService {
  constructor(
    /**
     * inject create post provider
     */
    private readonly createPostProvider: CreatePostProvider,
    /**
     * inject find one post provider
     */
    private readonly findOnePostProvider: FindOnePostProvider,
    /**
     * inject find all posts provider
     */
    private readonly findAllPostsProvider: FindAllPostsProvider,
    /**
     * inject update post provider
     */
    private readonly updatePostProvider: UpdatePostProvider,
    /**
     * inject remove post provider
     */
    private readonly removePostProvider: RemovePostProvider,
    /**
     * inject upload post image provider
     */
    private readonly uploadPostImageProvider: UploadPostImageProvider,
    /**
     * inject find post by slug provider
     */
    private readonly findPostBySlugProvider: FindPostBySlugProvider,
  ) {}

  public async create(
    createPostDto: CreatePostDto,
    activeUser: ActiveUserData,
  ) {
    return await this.createPostProvider.create(createPostDto, activeUser)
  }

  public async findAll(getPostsDto: GetPostsDto): Promise<Paginated<Post>> {
    return await this.findAllPostsProvider.findAll(getPostsDto)
  }

  public async findOne(id: number): Promise<Post> {
    return await this.findOnePostProvider.findOnePublishedByIdOrFail(id)
  }

  public async findBySlug(slug: string): Promise<Post> {
    return await this.findPostBySlugProvider.findBySlug(slug)
  }

  public async update(
    id: number,
    patchPostDto: PatchPostDto,
    activeUser: ActiveUserData,
  ): Promise<Post> {
    return await this.updatePostProvider.update(id, patchPostDto, activeUser)
  }

  public async remove(id: number, activeUser: ActiveUserData) {
    return await this.removePostProvider.remove(id, activeUser)
  }

  public async uploadPostImage(
    file: Express.Multer.File,
    postId: number,
    activeUser: ActiveUserData,
  ): Promise<UploadFile> {
    return await this.uploadPostImageProvider.uploadPostImage(
      file,
      postId,
      activeUser,
    )
  }
}
