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
   * Mock array acting as our posts "database" referencing user IDs
   */
  private readonly posts = [
    {
      id: 1,
      userId: 1, // Naruto Uzumaki
      title: 'The Will of Fire and Becoming Hokage',
      postType: 'post', // Adjust value based on your PostType enum
      slug: 'the-will-of-fire',
      status: 'published', // Adjust value based on your PostStatus enum
      content: 'I will become the Hokage, believe it! 🍥',
      featuredImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      publishOn: new Date('2026-05-29T12:00:00.000Z'),
      tags: ['ninja', 'hokage', 'konoha'],
      schema: '{"village":"Konoha","clan":"Uzumaki"}',
      metaOptions: [
        { metaValue: JSON.stringify({ key: 'sidebar', value: 'true' }) },
      ],
    },
    {
      id: 2,
      userId: 2, // Ichigo Kurosaki
      title: 'Reflections on Fate and Power',
      postType: 'post',
      slug: 'reflections-on-fate',
      status: 'draft',
      content: 'If fate is a millstone, then we are the grist.',
      featuredImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      publishOn: new Date('2026-06-01T09:30:00.000Z'),
      tags: ['shinigami', 'soul-society'],
      schema:
        '{"firstName":"Ichigo","lastName":"Kurosaki","email":"ichigo@bleach.com"}',
      metaOptions: [],
    },
    {
      id: 3,
      userId: 4, // Monkey D. Luffy
      title: 'Galley Feast Requests',
      postType: 'post',
      slug: 'galley-feast-requests',
      status: 'published',
      content: 'Sanji! I want meat! 🍖',
      featuredImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      publishOn: new Date('2026-05-25T18:00:00.000Z'),
      tags: ['pirates', 'meat', 'grand-line'],
      schema: '{"crew":"StrawHat","bounty":"3 Billion"}',
      metaOptions: [
        { metaValue: JSON.stringify({ key: 'allowComments', value: 'true' }) },
      ],
    },
    {
      id: 4,
      userId: 3, // Orihime Inoue
      title: 'Battlefield Safety Concerns',
      postType: 'post',
      slug: 'battlefield-safety-concerns',
      status: 'published',
      content: 'Kurosaki-kun! Please don’t get hurt!',
      featuredImage: undefined,
      publishOn: undefined,
      tags: ['healing', 'karakura-town'],
      schema: undefined,
      metaOptions: undefined,
    },
    {
      id: 5,
      userId: 5, // Goku Son
      title: 'Looking for Strong Opponents',
      postType: 'post',
      slug: 'looking-for-strong-opponents',
      status: 'published',
      content: 'Hey, I heard your power level is pretty high! Let’s fight! 💥',
      featuredImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      publishOn: new Date('2026-05-29T00:00:00.000Z'),
      tags: ['sayan', 'training', 'dbz'],
      schema: '{"powerLevel":9001}',
      metaOptions: [],
    },
    {
      id: 6,
      userId: 1, // Naruto Uzumaki
      title: 'The Best Culinary Spot in the World',
      postType: 'post',
      slug: 'the-best-culinary-spot',
      status: 'published',
      content: 'Ramen Ichiraku is the best place on earth. Extra pork please!',
      featuredImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      publishOn: new Date('2026-05-28T21:15:00.000Z'),
      tags: ['food', 'ramen'],
      schema: '{"favoriteDish":"Miso Chashu"}',
      metaOptions: [
        { metaValue: JSON.stringify({ key: 'rating', value: '5-stars' }) },
      ],
    },
    {
      id: 7,
      userId: 4, // Monkey D. Luffy
      title: 'My Ultimate Ambition',
      postType: 'post',
      slug: 'my-ultimate-ambition',
      status: 'published',
      content: 'I am going to be the King of the Pirates!! 🏴‍☠️',
      featuredImage: undefined,
      publishOn: new Date('2026-05-29T10:00:00.000Z'),
      tags: ['one-piece', 'ambition'],
      schema: undefined,
      metaOptions: [],
    },
    {
      id: 8,
      userId: 5, // Goku Son
      title: 'Post-Workout Nutrition Plan',
      postType: 'post',
      slug: 'post-workout-nutrition',
      status: 'draft',
      content:
        'Just finished training under 100x gravity. Time for a massive lunch!',
      featuredImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      publishOn: undefined,
      tags: ['gravity-training', 'bulking'],
      schema: '{"caloriesNeeded":50000}',
      metaOptions: [
        { metaValue: JSON.stringify({ key: 'status', value: 'hungry' }) },
      ],
    },
  ]
  /**
   * We use this method to create a new post
   */
  public async create(createPostDto: CreatePostDto) {
    const post = this.postsRepository.create(createPostDto)
    return await this.postsRepository.save(post)
  }
  /**
   * We use this method to get all the posts
   */
  public async findAll() {
    return await this.postsRepository.find()
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
  update(id: number, patchPostDto: PatchPostDto) {
    const thePost = this.posts.find((post) => post.id === id)
    if (!thePost) return
    Object.assign(thePost, patchPostDto)
    return thePost
  }
  /**
   * We use this method to remove a post
   */
  remove(id: number) {
    return `This action removes a #${id} post`
  }
}
