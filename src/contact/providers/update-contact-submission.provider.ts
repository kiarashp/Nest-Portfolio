import { Injectable, RequestTimeoutException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContactSubmission } from '../entities/contact-submission.entity'
import { PatchContactSubmissionDto } from '../dtos/patch-contact-submission.dto'
import { FindOneContactSubmissionProvider } from './find-one-contact-submission.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateContactSubmissionProvider {
  constructor(
    /**
     * inject `ContactSubmission` repository
     */
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionRepository: Repository<ContactSubmission>,
    /**
     * inject find-one contact submission provider to resolve the target row
     */
    private readonly findOneContactSubmissionProvider: FindOneContactSubmissionProvider,
    /** inject audit log service to record the handled-flag toggle */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Toggles the `handled` flag on a contact submission. The acting admin's id
   * is recorded in the audit log after a successful save.
   */
  public async update(
    id: number,
    dto: PatchContactSubmissionDto,
    activeUserId: number,
  ): Promise<ContactSubmission> {
    const submission =
      await this.findOneContactSubmissionProvider.findOneByIdOrFail(id)

    submission.handled = dto.handled

    let saved: ContactSubmission
    try {
      saved = await this.contactSubmissionRepository.save(submission)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }

    await this.auditLogService.log(
      activeUserId,
      AuditAction.UPDATE,
      'ContactSubmission',
      id,
    )

    return saved
  }
}
