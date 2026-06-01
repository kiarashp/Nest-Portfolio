import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MetaOption } from '../entities/meta-option.entity'
import { CreatePostMetaOptionsDto } from '../dto/create-post-meta-options.dto'

@Injectable()
export class MetaOptionsService {
  constructor(
    /**
     * injecting meta options repository
     */
    @InjectRepository(MetaOption)
    private readonly metaOptionsRepository: Repository<MetaOption>,
  ) {}
  /**
   * create a new meta option
   */
  public async create(createPostMetaOptionsDto: CreatePostMetaOptionsDto) {
    const metaOption = this.metaOptionsRepository.create(
      createPostMetaOptionsDto,
    )
    return await this.metaOptionsRepository.save(metaOption)
  }
}
