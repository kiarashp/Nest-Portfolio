import { Injectable } from '@nestjs/common'
import { CreateTagDto } from '../dto/create-tag.dto'
import { In, Repository } from 'typeorm'
import { Tag } from '../entities/tag.entity'
import { InjectRepository } from '@nestjs/typeorm'

@Injectable()
export class TagsService {
  constructor(
    /**
     * injecting tag repository
     */
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  /**
   * Creates a new tag
   */
  public async create(createTagDto: CreateTagDto) {
    const tag = this.tagsRepository.create(createTagDto)
    return await this.tagsRepository.save(tag)
  }

  /**
   * Find all tags
   */
  public async findAll() {
    return await this.tagsRepository.find()
  }
  /**
   * Find multiple tags and return them
   */
  public async findMany(ids: number[] | undefined) {
    if (!ids || ids.length === 0) {
      return []
    }
    console.log(ids)
    const result = await this.tagsRepository.find({ where: { id: In(ids) } })
    console.log(result)
    return result
  }
  /**
   * delete a tag
   */
  public async delete(id: number) {
    await this.tagsRepository.delete(id)
    return { deleted: true, id }
  }
  /**
   * soft delete a tag
   */
  public async softDelete(id: number) {
    await this.tagsRepository.softDelete(id)
    return { deleted: true, id }
  }
}
