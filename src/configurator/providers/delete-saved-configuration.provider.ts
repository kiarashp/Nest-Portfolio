import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class DeleteSavedConfigurationProvider {
  private readonly logger = new Logger(DeleteSavedConfigurationProvider.name)

  constructor(
    /** inject SavedConfiguration repository for deletion */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject find-one provider for the owner-scoped 404 guard */
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    /** inject audit log service to record the deletion */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Hard-deletes one of the calling user's saved configurations. The
   * owner-scoped lookup 404s for a snapshot the caller does not own, so no
   * separate ownership check is needed. Hard delete is deliberate — only
   * ConfigurableProduct soft-deletes in this module.
   */
  public async delete(
    id: number,
    userId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    await this.findOneSavedConfigurationProvider.findOneOwnedOrFail(id, userId)

    await this.savedConfigurationsRepository.delete(id)
    this.logger.log(`Saved configuration deleted — id=${id}, userId=${userId}`)
    await this.auditLogService.log(
      userId,
      AuditAction.DELETE,
      'SavedConfiguration',
      id,
    )
    return { deleted: true, id }
  }
}
