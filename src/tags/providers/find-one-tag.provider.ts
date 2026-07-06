import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Tag } from '../entities/tag.entity'

@Injectable()
export class FindOneTagProvider {
  constructor(
    /**
     * inject `Tag` repository
     */
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  /**
   * Returns the tag or null if not found. Use when the caller needs to decide
   * what to do with a missing tag.
   */
  public async findOneById(id: number): Promise<Tag | null> {
    try {
      return await this.tagsRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }

  /**
   * Returns the tag or throws NotFoundException. Use when a missing tag is
   * always an error (e.g. the public single-tag read endpoint).
   */
  public async findOneByIdOrFail(id: number): Promise<Tag> {
    const tag = await this.findOneById(id)
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`)
    }
    return tag
  }
}
