import {
  ForbiddenException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { MetaOption } from '../entities/meta-option.entity'
import { UpdateMetaOptionDto } from '../dto/update-meta-option.dto'
import { FindOneMetaOptionProvider } from './find-one-meta-option.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateMetaOptionProvider {
  private readonly logger = new Logger(UpdateMetaOptionProvider.name)

  constructor(
    /** inject MetaOption repository */
    @InjectRepository(MetaOption)
    private readonly metaOptionsRepository: Repository<MetaOption>,
    /** inject find-one provider to look up the meta option with ownership data */
    private readonly findOneMetaOptionProvider: FindOneMetaOptionProvider,
    /** inject audit log service to record the update */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Updates a MetaOption's metaValue. Only the post author or an ADMIN may do
   * this — all other callers receive a 403.
   */
  public async update(
    id: number,
    updateMetaOptionDto: UpdateMetaOptionDto,
    activeUser: ActiveUserData,
  ): Promise<MetaOption> {
    const metaOption = await this.findOneMetaOptionProvider.findOneById(id)

    if (
      activeUser.role !== UserRole.ADMIN &&
      metaOption.post.author.id !== activeUser.sub
    ) {
      this.logger.warn(
        `MetaOption update denied — metaOptionId=${id}, userId=${activeUser.sub}`,
      )
      throw new ForbiddenException(
        'You can only update meta options for your own posts',
      )
    }

    if (updateMetaOptionDto.metaValue !== undefined) {
      metaOption.metaValue = updateMetaOptionDto.metaValue
    }

    try {
      const saved = await this.metaOptionsRepository.save(metaOption)
      this.logger.log(
        `MetaOption updated — metaOptionId=${id}, updatedById=${activeUser.sub}`,
      )
      await this.auditLogService.log(
        activeUser.sub,
        AuditAction.UPDATE,
        'MetaOption',
        id,
      )
      return saved
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
