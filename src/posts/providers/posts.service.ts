import { Injectable } from '@nestjs/common'
import type { Request } from 'express'
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
import { FindMyPostsProvider } from './find-my-posts.provider'
import { ManagePostTagsProvider } from './manage-post-tags.provider'
import { FindPostImagesProvider } from './find-post-images.provider'
import { DeletePostImageProvider } from './delete-post-image.provider'
import { PostTagsDto } from '../dto/post-tags.dto'

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
    /**
     * inject find my posts provider
     */
    private readonly findMyPostsProvider: FindMyPostsProvider,
    /**
     * inject manage post tags provider
     */
    private readonly managePostTagsProvider: ManagePostTagsProvider,
    /**
     * inject find post images provider
     */
    private readonly findPostImagesProvider: FindPostImagesProvider,
    /**
     * inject delete post image provider
     */
    private readonly deletePostImageProvider: DeletePostImageProvider,
  ) {}

  public async create(
    createPostDto: CreatePostDto,
    activeUser: ActiveUserData,
  ) {
    return await this.createPostProvider.create(createPostDto, activeUser)
  }

  public async findAll(
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    return await this.findAllPostsProvider.findAll(getPostsDto, request)
  }

  /** Returns all posts across all statuses and authors — admin-only. */
  public async findAllAdmin(
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    return await this.findAllPostsProvider.findAllAdmin(getPostsDto, request)
  }

  /** Returns the caller's own posts across all statuses, with an optional status filter. */
  public async findMyPosts(
    userId: number,
    getPostsDto: GetPostsDto,
    request: Request,
  ): Promise<Paginated<Post>> {
    return await this.findMyPostsProvider.findMyPosts(
      userId,
      getPostsDto,
      request,
    )
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

  /** Returns all images uploaded for a post. */
  public async findPostImages(
    postId: number,
    activeUser: ActiveUserData,
  ): Promise<UploadFile[]> {
    return await this.findPostImagesProvider.findPostImages(postId, activeUser)
  }

  /** Deletes a single image from a post and clears featuredImage if it pointed there. */
  public async deletePostImage(
    postId: number,
    fileId: number,
    activeUser: ActiveUserData,
  ): Promise<{ deleted: boolean; id: number }> {
    return await this.deletePostImageProvider.deletePostImage(
      postId,
      fileId,
      activeUser,
    )
  }

  /** Adds tags to a post without replacing existing ones. */
  public async addTags(
    postId: number,
    dto: PostTagsDto,
    activeUser: ActiveUserData,
  ): Promise<Post> {
    return await this.managePostTagsProvider.addTags(
      postId,
      dto.tagIds,
      activeUser,
    )
  }

  /** Removes tags from a post. Idempotent — removing a tag not on the post is a no-op. */
  public async removeTags(
    postId: number,
    dto: PostTagsDto,
    activeUser: ActiveUserData,
  ): Promise<Post> {
    return await this.managePostTagsProvider.removeTags(
      postId,
      dto.tagIds,
      activeUser,
    )
  }
}
