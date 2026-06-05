import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { CreatePostDto } from '../dto/create-post.dto'
import { UsersService } from 'src/users/providers/users.service'
import { TagsService } from 'src/tags/providers/tags.service'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Post } from '../entities/post.entity'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { Tag } from 'src/tags/entities/tag.entity'
import { User } from 'src/users/entities/user.entity'

@Injectable()
export class CreatePostProvider {
  constructor(
    /**
     * inject user service
     */
    private readonly usersService: UsersService,
    /**
     * inject tag service
     */
    private readonly tagsService: TagsService,
    /**
     * inject post repository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  /**
   * create a new post
   */
  public async create(
    createPostDto: CreatePostDto,
    activeUser: ActiveUserData,
  ) {
    let author: User | null = null
    let tags: Tag[] | null = null
    try {
      //find author
      author = await this.usersService.findOneById(activeUser.sub)
      //find tags
      tags = await this.tagsService.findMany(createPostDto.tags)
    } catch (error) {
      throw new ConflictException(error)
    }
    if (createPostDto.tags?.length !== tags?.length)
      throw new BadRequestException('please check the tags ID and try again')

    //create post
    const post = this.postsRepository.create({
      ...createPostDto,
      author: author,
      tags: tags,
    })
    try {
      return await this.postsRepository.save(post)
    } catch (error) {
      throw new ConflictException(error, {
        description: 'Ensure that the post slug is unique',
      })
    }
  }
}
