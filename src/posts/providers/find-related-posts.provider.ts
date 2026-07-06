import { Injectable, RequestTimeoutException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Post } from '../entities/post.entity'
import { PostStatus } from '../enums/postStatus.enum'
import { FindOnePostProvider } from './find-one-post.provider'

/** Number of related posts returned when the caller does not send ?limit. */
const DEFAULT_RELATED_LIMIT = 4

@Injectable()
export class FindRelatedPostsProvider {
  constructor(
    /** inject Post repository */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /** inject find-one post provider, used to resolve and validate the anchor post */
    private readonly findOnePostProvider: FindOnePostProvider,
  ) {}

  /**
   * Returns up to `limit` other published posts that share at least one tag
   * with the anchor post, newest first, excluding the anchor itself. The
   * anchor is resolved with the same published-only rule as GET /posts/:id,
   * so a missing or unpublished id 404s instead of returning an empty array.
   * A tagless anchor has no related posts by definition and returns an empty
   * array immediately — there is no fallback to unrelated posts.
   */
  public async findRelated(
    id: number,
    limit: number = DEFAULT_RELATED_LIMIT,
  ): Promise<Post[]> {
    const anchor = await this.findOnePostProvider.findOnePublishedByIdOrFail(id)

    if (!anchor.tags?.length) {
      return []
    }

    const tagIds = anchor.tags.map((tag) => tag.id)

    try {
      // leftJoinAndSelect keeps the (eager) author/tags in the response —
      // eager relations are not auto-loaded when using a QueryBuilder.
      const qb = this.postsRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .leftJoinAndSelect('post.tags', 'tags')
        .where('post.status = :status', { status: PostStatus.PUBLISHED })
        .andWhere('post.id != :id', { id: anchor.id })

      // Subquery against the join table rather than a condition on the 'tags'
      // join alias above: filtering on that alias would also restrict which
      // tags get selected (only the matching ones), when a post's full tag
      // list should always be returned.
      const tagPostIdsSubQuery = qb
        .subQuery()
        .select('pt."postId"')
        .from('post_tags_tag', 'pt')
        .where('pt."tagId" IN (:...tagIds)')
        .getQuery()
      qb.andWhere(`post.id IN ${tagPostIdsSubQuery}`, { tagIds })

      qb.orderBy('post.createdAt', 'DESC')
        .addOrderBy('post.id', 'DESC')
        .take(limit)

      return await qb.getMany()
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
