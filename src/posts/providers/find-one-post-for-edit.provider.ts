import { ForbiddenException, Injectable } from '@nestjs/common'
import { Post } from '../entities/post.entity'
import { FindOnePostProvider } from './find-one-post.provider'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Injectable()
export class FindOnePostForEditProvider {
  constructor(
    /**
     * inject FindOnePostProvider to look up the post regardless of status
     */
    private readonly findOnePostProvider: FindOnePostProvider,
  ) {}

  /**
   * Returns a single post by ID regardless of status — draft, review,
   * scheduled, or published. Used by the staff edit form, which needs to load
   * a post that GET /posts/:id (published-only) cannot return. Editors can
   * only fetch posts they authored; authors and admins can fetch any post.
   */
  public async findOneForEdit(
    id: number,
    activeUser: ActiveUserData,
  ): Promise<Post> {
    const post = await this.findOnePostProvider.findOneByIdOrFail(id)

    if (
      activeUser.role === UserRole.EDITOR &&
      post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException('You are not allowed to view this post')
    }

    return post
  }
}
