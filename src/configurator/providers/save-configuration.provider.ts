import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { ResolveConfigurationDto } from '../dtos/resolve-configuration.dto'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { ConfiguratorResolverService } from './configurator-resolver.service'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class SaveConfigurationProvider {
  private readonly logger = new Logger(SaveConfigurationProvider.name)

  constructor(
    /** inject SavedConfiguration repository for persistence */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
    /** inject find-one provider to load the published product by slug */
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    /** inject the resolver — the server re-resolves and never trusts a client-composed code */
    private readonly configuratorResolverService: ConfiguratorResolverService,
    /** inject audit log service to record the snapshot creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Saves a frozen snapshot of a resolved configuration for the calling user
   * (CONFIGURATOR.md §5.3). The selections are re-resolved server-side against
   * the live product; an invalid resolve is rejected with 400 carrying the
   * resolver's per-segment error messages. The stored row snapshots the
   * product name, composed code, rendered summary, and the raw selections —
   * it is never re-resolved again, so later admin edits cannot change it.
   * Unknown, unpublished, or soft-deleted slugs 404, same rule as resolve.
   */
  public async save(
    slug: string,
    dto: ResolveConfigurationDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    const product =
      await this.findOneConfigurableProductProvider.findOneBySlugPublishedOrFail(
        slug,
      )

    const result = this.configuratorResolverService.resolve(
      product,
      dto.selections,
    )
    if (!result.valid) {
      // same message-array shape as a class-validator 400
      throw new BadRequestException(result.errors.map((e) => e.message))
    }

    const snapshot = this.savedConfigurationsRepository.create({
      userId: activeUserId,
      productId: product.id,
      productName: product.name,
      code: result.code,
      summary: result.summary,
      selections: dto.selections,
    })
    const saved = await this.savedConfigurationsRepository.save(snapshot)
    this.logger.log(
      `Configuration saved — id=${saved.id}, userId=${activeUserId}, code=${saved.code}`,
    )
    await this.auditLogService.log(
      activeUserId,
      AuditAction.CREATE,
      'SavedConfiguration',
      saved.id,
    )
    return saved
  }
}
