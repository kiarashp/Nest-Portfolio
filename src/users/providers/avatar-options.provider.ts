import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StorageProvider } from 'src/uploads/providers/storage.provider'
import { AvatarOption } from '../entities/avatar-option.entity'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class AvatarOptionsProvider {
  private readonly logger = new Logger(AvatarOptionsProvider.name)

  constructor(
    /**
     * Inject the AvatarOption repository for DB reads and writes
     */
    @InjectRepository(AvatarOption)
    private readonly avatarOptionRepo: Repository<AvatarOption>,

    /**
     * Inject StorageProvider to upload images to the active storage backend
     * and delete them on removal
     */
    private readonly storageProvider: StorageProvider,

    /** inject audit log service to record create and delete operations */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Returns all avatar options ordered by id ascending.
   */
  public async findAll(): Promise<AvatarOption[]> {
    return this.avatarOptionRepo.find({ order: { id: 'ASC' } })
  }

  /**
   * Returns a single avatar option by id. Throws NotFoundException if no
   * option with that id exists.
   */
  public async findOne(id: number): Promise<AvatarOption> {
    const option = await this.avatarOptionRepo.findOne({ where: { id } })
    if (!option) throw new NotFoundException('Avatar option not found')
    return option
  }

  /**
   * Uploads the file to the active storage backend, then saves the url and
   * publicId to the DB. The acting admin's id is recorded in the audit log
   * after a successful save.
   */
  public async create(
    file: Express.Multer.File,
    activeUserId: number,
  ): Promise<AvatarOption> {
    const { url, publicId } = await this.storageProvider.upload(file, 'avatars')
    try {
      const saved = await this.avatarOptionRepo.save({ url, publicId })
      this.logger.log(
        `Avatar option created — id=${saved.id}, publicId=${publicId}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.CREATE,
        'AvatarOption',
        saved.id,
      )
      return saved
    } catch {
      this.logger.error(`Failed to save avatar option — publicId=${publicId}`)
      throw new BadRequestException('Could not save avatar option')
    }
  }

  /**
   * Deletes the asset from the active storage backend and removes the DB row.
   * Throws NotFoundException if no option with that id exists.
   * The acting admin's id is recorded in the audit log after successful deletion.
   */
  public async remove(
    id: number,
    activeUserId: number,
  ): Promise<{ message: string }> {
    const option = await this.avatarOptionRepo.findOne({ where: { id } })
    if (!option) throw new NotFoundException('Avatar option not found')

    await this.storageProvider.delete(option.publicId)
    await this.avatarOptionRepo.delete(id)

    this.logger.log(
      `Avatar option removed — id=${id}, publicId=${option.publicId}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.DELETE,
      'AvatarOption',
      id,
    )
    return { message: 'Avatar option removed' }
  }
}
