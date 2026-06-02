import { Body, Injectable } from '@nestjs/common'
import { CreatePostDto } from '../dto/create-post.dto'
import { PatchPostDto } from '../dto/update-post.dto'
import { UsersService } from 'src/users/providers/users.service'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { MetaOption } from 'src/meta-options/entities/meta-option.entity'

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
    //create post
    const post = this.postsRepository.create({
      ...createPostDto,
      author: author,
    })
    return await this.postsRepository.save(post)
  }
  /**
   * We use this method to get all the posts
   */
  public async findAll() {
    return await this.postsRepository.find({
      relations: {
        metaOptions: true,
        author: true,
      }
    })
  }
  /**
   * We use this method to get a single post
   */
  findOne(id: number) {
    return this.postsRepository.findOneBy({ id })
  }
  /**
   * We use this method to update a post
   */
  public async update(id: number, patchPostDto: PatchPostDto) {
    const thePost = await this.postsRepository.findOneBy({ id })
    if (!thePost) return { message: 'Post not found', status: 404 }

    await this.postsRepository.update(id, patchPostDto)
    return thePost
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
