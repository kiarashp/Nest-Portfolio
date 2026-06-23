import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MetaOption } from '../entities/meta-option.entity'

@Injectable()
export class FindOneMetaOptionProvider {
  constructor(
    /** inject MetaOption repository */
    @InjectRepository(MetaOption)
    private readonly metaOptionsRepository: Repository<MetaOption>,
  ) {}

  /**
   * Returns a MetaOption by ID. Loads the associated post and its author so
   * callers can perform ownership checks without a second query.
   * Throws NotFoundException when the row does not exist.
   */
  public async findOneById(id: number): Promise<MetaOption> {
    const metaOption: MetaOption | null =
      await this.metaOptionsRepository.findOne({
        where: { id },
        relations: { post: { author: true } },
      })
    if (!metaOption) {
      throw new NotFoundException(`MetaOption with id ${id} not found`)
    }
    return metaOption
  }
}
