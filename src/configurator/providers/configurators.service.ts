import { Injectable } from '@nestjs/common'
import { FindOneConfigurableProductProvider } from './find-one-configurable-product.provider'
import { ConfiguratorResolverService } from './configurator-resolver.service'
import { buildFormSchema } from './build-form-schema.util'
import { ConfiguratorFormSchemaDto } from '../dtos/configurator-form-schema.dto'
import { ResolveConfigurationDto } from '../dtos/resolve-configuration.dto'
import { ResolveResultDto } from '../dtos/resolve-result.dto'

// Thin facade for the public configurator endpoints (CONFIGURATOR.md §5.2).
// Both operations are reads/stateless computation, so unlike the admin
// facades this one writes no audit logs and injects no AuditLogService.
@Injectable()
export class ConfiguratorsService {
  constructor(
    // finds published products by slug with the full ordered assignment tree
    private readonly findOneConfigurableProductProvider: FindOneConfigurableProductProvider,
    // the stateless resolve algorithm (CONFIGURATOR.md §4.3)
    private readonly configuratorResolverService: ConfiguratorResolverService,
  ) {}

  /**
   * Returns the public form schema for a published configurator: curated
   * product header fields plus every segment ordered by position. 404 when
   * the slug is unknown, unpublished, or soft-deleted.
   */
  public async getFormSchema(slug: string): Promise<ConfiguratorFormSchemaDto> {
    const product =
      await this.findOneConfigurableProductProvider.findOneBySlugPublishedOrFail(
        slug,
      )
    return buildFormSchema(product)
  }

  /**
   * Resolves a customer's selections against a published configurator:
   * validates every active segment, evaluates zero-fill conditions, and
   * composes the ordering code + human summary. Stateless — nothing persists.
   */
  public async resolve(
    slug: string,
    dto: ResolveConfigurationDto,
  ): Promise<ResolveResultDto> {
    const product =
      await this.findOneConfigurableProductProvider.findOneBySlugPublishedOrFail(
        slug,
      )
    return this.configuratorResolverService.resolve(product, dto.selections)
  }
}
