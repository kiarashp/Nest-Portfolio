import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { PatchSavedConfigurationStatusDto } from '../dtos/patch-saved-configuration-status.dto'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateQuoteStatusProvider {
  constructor(
    /** inject SavedConfiguration repository to persist the status */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject find-one provider to resolve the target row, unscoped by owner */
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    /** inject audit log service to record the manual status change */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Sets the quote request's status to any value directly — the manual admin
   * override, unlike the automatic PENDING/ANSWERED bumps message posts
   * perform. 400 when no quote was ever requested, preserving the invariant
   * that quoteStatus is null exactly when quoteRequestedAt is null. The
   * acting admin's id is recorded in the audit log after a successful save —
   * same entity string ('SavedConfiguration') as the create/delete/
   * request-quote audit entries, so the whole lifecycle groups together.
   */
  public async updateStatus(
    id: number,
    dto: PatchSavedConfigurationStatusDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    const savedConfiguration =
      await this.findOneSavedConfigurationProvider.findOneByIdOrFail(id)

    if (!savedConfiguration.quoteRequestedAt) {
      throw new BadRequestException(
        'A quote has not been requested for this saved configuration',
      )
    }

    savedConfiguration.quoteStatus = dto.quoteStatus

    let saved: SavedConfiguration
    try {
      saved = await this.savedConfigurationsRepository.save(savedConfiguration)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }

    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'SavedConfiguration',
      id,
    )

    return saved
  }
}
