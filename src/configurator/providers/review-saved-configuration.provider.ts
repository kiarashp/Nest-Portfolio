import { Injectable, RequestTimeoutException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { PatchSavedConfigurationReviewedDto } from '../dtos/patch-saved-configuration-reviewed.dto'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class ReviewSavedConfigurationProvider {
  constructor(
    /** inject SavedConfiguration repository to persist the reviewed flag */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject find-one provider to resolve the target row, unscoped by owner */
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    /** inject audit log service to record the reviewed-flag toggle */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Toggles the quoteReviewed flag on a saved configuration's quote request.
   * The acting admin's id is recorded in the audit log after a successful
   * save. Same entity string ('SavedConfiguration') as the create/delete/
   * request-quote audit entries, so the whole lifecycle groups together.
   */
  public async review(
    id: number,
    dto: PatchSavedConfigurationReviewedDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    const savedConfiguration =
      await this.findOneSavedConfigurationProvider.findOneByIdOrFail(id)

    savedConfiguration.quoteReviewed = dto.quoteReviewed

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
