import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { Tag } from '../entities/tag.entity'
import { UpdateTagDto } from '../dto/update-tag.dto'

@Injectable()
export class UpdateTagProvider {
  private readonly logger = new Logger(UpdateTagProvider.name)

  constructor(
    /**
     * inject tag repository
     */
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  /**
   * Applies a partial update to a tag. Throws NotFoundException if the tag
   * does not exist, ConflictException if the new name or slug collides with
   * an existing tag.
   */
  public async update(id: number, updateTagDto: UpdateTagDto): Promise<Tag> {
    // Find the tag — throw 404 if it does not exist.
    const tag: Tag | null = await this.tagsRepository.findOneBy({ id })
    if (!tag) {
      throw new NotFoundException(`Tag with id ${id} was not found`)
    }

    // Apply only the fields that were provided in the DTO.
    tag.name = updateTagDto.name ?? tag.name
    tag.slug = updateTagDto.slug ?? tag.slug
    tag.description = updateTagDto.description ?? tag.description
    tag.schema = updateTagDto.schema ?? tag.schema
    tag.featuredImage = updateTagDto.featuredImage ?? tag.featuredImage

    // Persist and catch unique constraint violations from `name` and `slug`.
    try {
      const saved = await this.tagsRepository.save(tag)
      this.logger.log(`Tag updated — tagId=${id}`)
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        this.logger.warn(
          `Tag update conflict: name or slug already in use — tagId=${id}`,
        )
        throw new ConflictException('Tag name or slug already in use')
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
