import {
  ForbiddenException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { MetaOption } from '../entities/meta-option.entity'
import { FindOneMetaOptionProvider } from './find-one-meta-option.provider'

@Injectable()
export class DeleteMetaOptionProvider {
  constructor(
    /** inject MetaOption repository */
    @InjectRepository(MetaOption)
    private readonly metaOptionsRepository: Repository<MetaOption>,
    /** inject find-one provider to look up the meta option with ownership data */
    private readonly findOneMetaOptionProvider: FindOneMetaOptionProvider,
  ) {}

  /**
   * Deletes a MetaOption by ID. Only the post author or an ADMIN may do this.
   * The post itself is not removed — only the MetaOption row is deleted.
   */
  public async delete(
    id: number,
    activeUser: ActiveUserData,
  ): Promise<{ deleted: boolean; id: number }> {
    const metaOption = await this.findOneMetaOptionProvider.findOneById(id)

    if (
      activeUser.role !== UserRole.ADMIN &&
      metaOption.post.author.id !== activeUser.sub
    ) {
      throw new ForbiddenException(
        'You can only delete meta options for your own posts',
      )
    }

    try {
      await this.metaOptionsRepository.remove(metaOption)
      return { deleted: true, id }
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
