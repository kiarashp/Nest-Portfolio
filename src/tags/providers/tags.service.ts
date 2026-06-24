import { Injectable, Logger } from '@nestjs/common'
import { CreateTagDto } from '../dto/create-tag.dto'
import { UpdateTagDto } from '../dto/update-tag.dto'
import { In, Repository } from 'typeorm'
import { Tag } from '../entities/tag.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { UpdateTagProvider } from './update-tag.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

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
    /** inject audit log service to record tag writes */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Updates an existing tag by ID with the provided partial fields.
   */
  public async update(id: number, updateTagDto: UpdateTagDto): Promise<Tag> {
    return this.updateTagProvider.update(id, updateTagDto)
  }

  /**
   * Creates a new tag. The acting user's id is recorded in the audit log after a
   * successful save.
   */
  public async create(createTagDto: CreateTagDto, activeUserId: number) {
    const tag = this.tagsRepository.create(createTagDto)
    const saved = await this.tagsRepository.save(tag)
    this.logger.log(`Tag created — tagId=${saved.id}, slug=${saved.slug}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.CREATE,
      'Tag',
      saved.id,
    )
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
   * Hard-deletes a tag. The acting user's id is recorded in the audit log after deletion.
   */
  public async delete(id: number, activeUserId: number) {
    await this.tagsRepository.delete(id)
    this.logger.log(`Tag hard-deleted — tagId=${id}`)
    await this.auditLogService.log(activeUserId, AuditAction.DELETE, 'Tag', id)
    return { deleted: true, id }
  }

  /**
   * Soft-deletes a tag (sets deletedAt). The acting user's id is recorded in the
   * audit log after deletion.
   */
  public async softDelete(id: number, activeUserId: number) {
    await this.tagsRepository.softDelete(id)
    this.logger.log(`Tag soft-deleted — tagId=${id}`)
    await this.auditLogService.log(
      activeUserId,
      AuditAction.SOFT_DELETE,
      'Tag',
      id,
    )
    return { deleted: true, id }
  }
}
