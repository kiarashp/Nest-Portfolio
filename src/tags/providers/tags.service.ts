import { Injectable, Logger } from '@nestjs/common'
import { CreateTagDto } from '../dto/create-tag.dto'
import { UpdateTagDto } from '../dto/update-tag.dto'
import { In, Repository } from 'typeorm'
import { Tag } from '../entities/tag.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { UpdateTagProvider } from './update-tag.provider'

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name)

  constructor(
    /**
     * injecting tag repository
     */
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    /**
     * inject update tag provider
     */
    private readonly updateTagProvider: UpdateTagProvider,
  ) {}

  /**
   * Updates an existing tag by ID with the provided partial fields.
   */
  public async update(id: number, updateTagDto: UpdateTagDto): Promise<Tag> {
    return this.updateTagProvider.update(id, updateTagDto)
  }

  /**
   * Creates a new tag
   */
  public async create(createTagDto: CreateTagDto) {
    const tag = this.tagsRepository.create(createTagDto)
    const saved = await this.tagsRepository.save(tag)
    this.logger.log(`Tag created — tagId=${saved.id}, slug=${saved.slug}`)
    return saved
  }

  /**
   * Find all tags. Capped at 200 rows so a runaway DB query can't stall the
   * response even if the tag list grows unexpectedly large.
   */
  public async findAll() {
    return await this.tagsRepository.find({ take: 200 })
  }
  /**
   * Find multiple tags and return them
   */
  public async findMany(ids: number[] | undefined) {
    if (!ids || ids.length === 0) {
      return []
    }
    const result = await this.tagsRepository.find({ where: { id: In(ids) } })
    return result
  }
  /**
   * delete a tag
   */
  public async delete(id: number) {
    await this.tagsRepository.delete(id)
    this.logger.log(`Tag hard-deleted — tagId=${id}`)
    return { deleted: true, id }
  }
  /**
   * soft delete a tag
   */
  public async softDelete(id: number) {
    await this.tagsRepository.softDelete(id)
    this.logger.log(`Tag soft-deleted — tagId=${id}`)
    return { deleted: true, id }
  }
}
