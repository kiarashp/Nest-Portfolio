import {
  BadRequestException,
  Body,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { CreatePostDto } from '../dto/create-post.dto'
import { PatchPostDto } from '../dto/update-post.dto'
import { UsersService } from 'src/users/providers/users.service'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'
import { TagsService } from 'src/tags/providers/tags.service'
import { Tag } from 'src/tags/entities/tag.entity'
import { GetPostsDto } from '../dto/get-posts.dto'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

/**
 * Class to connect to the posts "database" and perform actions on it
 */
@Injectable()
export class PostsService {
  /**
   * Creates an instance of PostsService and injects UsersService
   */
  constructor(
    /**
     * Inject User Service
     */
    private readonly usersService: UsersService,

    /*
     * Inject Tag Service
     */
    private readonly tagsService: TagsService,

    /**
     * Inject pagination provider
     */
    private readonly paginationProvider: PaginationProvider,
    /**
     * Inject Post Repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,

    /**
     * Inject Meta Option Repository
     */
    @InjectRepository(MetaOption)
    private readonly metaOptionsRepository: Repository<MetaOption>,
  ) {}
  /**
   * We use this method to create a new post
   */
  public async create(createPostDto: CreatePostDto) {
    //find author
    const author = await this.usersService.findOneById(createPostDto.authorId)
    if (!author) return { message: 'Author not found', status: 404 }
    //find tags

    const tags = await this.tagsService.findMany(createPostDto.tags)

    //create post
    const post = this.postsRepository.create({
      ...createPostDto,
      author: author,
      tags: tags,
    })
    return await this.postsRepository.save(post)
  }
  /**
   * We use this method to get all the posts
   */
  public async findAll(getPostsDto: GetPostsDto): Promise<Paginated<Post>> {
    return await this.paginationProvider.paginateQuery(
      {
        page: getPostsDto.page,
        limit: getPostsDto.limit,
      },
      this.postsRepository,
    )
  }
  /**
   * We use this method to get a single post
   */
  public async findOne(id: number) {
    let existingPost: Post | null = null
    try {
      existingPost = await this.postsRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!existingPost) {
      throw new NotFoundException(`Post with ID ${id} not found`)
    }
    return existingPost
  }
  /**
   * We use this method to update a post
   */
  public async update(id: number, patchPostDto: PatchPostDto) {
    // Find the tags
    let tags: Tag[] | null = null
    if (patchPostDto.tags) {
      try {
        tags = await this.tagsService.findMany(patchPostDto.tags)
      } catch {
        throw new RequestTimeoutException(
          'Unable to process your request, please try again later',
        )
      }
      /**
       * number of tags need to be equal the number of tags in the database
       */
      if (!tags || tags.length !== patchPostDto.tags.length) {
        throw new BadRequestException('please check the tags ID and try again')
      }
    }
    //Find the post
    let post: Post | null = null
    try {
      post = await this.postsRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`)
    }
    //update the post
    post.title = patchPostDto.title ?? post.title
    post.postType = patchPostDto.postType ?? post.postType
    post.slug = patchPostDto.slug ?? post.slug
    post.status = patchPostDto.status ?? post.status
    post.content = patchPostDto.content ?? post.content
    post.featuredImage = patchPostDto.featuredImage ?? post.featuredImage
    post.publishOn = patchPostDto.publishOn ?? post.publishOn
    //assign the new tags
    if (tags) {
      post.tags = tags
    }
    //save the post
    try {
      await this.postsRepository.save(post)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    return post
  }
  /**
   * We use this method to remove a post
   */
  public async remove(id: number) {
    //find the post
    const post = await this.postsRepository.findOneBy({ id })
    if (!post)
      return {
        message: 'Post not found',
        status: 404,
      }
    // delete the post
    await this.postsRepository.delete(post.id)

    return { deleted: true, id }
  }
}
