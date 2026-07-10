import { Injectable } from '@nestjs/common'
import { Request } from 'express'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { ResolveConfigurationDto } from '../dtos/resolve-configuration.dto'
import { GetSavedConfigurationsDto } from '../dtos/get-saved-configurations.dto'
import { SaveConfigurationProvider } from './save-configuration.provider'
import { FindMySavedConfigurationsProvider } from './find-my-saved-configurations.provider'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { DeleteSavedConfigurationProvider } from './delete-saved-configuration.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

// Thin facade for saved configurations (CONFIGURATOR.md §5.3, Phase 2):
// frozen snapshots of resolved configurations owned by registered users.
// Every operation is scoped to the calling user — there is no admin surface.
@Injectable()
export class SavedConfigurationsService {
  constructor(
    // re-resolves selections server-side and persists the snapshot
    private readonly saveConfigurationProvider: SaveConfigurationProvider,
    // paginated list of the caller's own snapshots
    private readonly findMySavedConfigurationsProvider: FindMySavedConfigurationsProvider,
    // owner-scoped single read (404 for missing and non-owned alike)
    private readonly findOneSavedConfigurationProvider: FindOneSavedConfigurationProvider,
    // owner-scoped hard delete
    private readonly deleteSavedConfigurationProvider: DeleteSavedConfigurationProvider,
  ) {}

  /**
   * Re-resolves the selections against the published product and stores a
   * frozen snapshot for the calling user. 400 if the resolve is invalid.
   */
  public async save(
    slug: string,
    dto: ResolveConfigurationDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    return await this.saveConfigurationProvider.save(slug, dto, activeUserId)
  }

  /**
   * Returns a paginated list of the calling user's saved configurations,
   * newest first.
   */
  public async findMy(
    userId: number,
    dto: GetSavedConfigurationsDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    return await this.findMySavedConfigurationsProvider.findMy(
      userId,
      dto,
      request,
    )
  }

  /**
   * Returns one of the calling user's saved configurations; 404 when the id
   * does not exist or belongs to another user.
   */
  public async findOne(
    id: number,
    userId: number,
  ): Promise<SavedConfiguration> {
    return await this.findOneSavedConfigurationProvider.findOneOwnedOrFail(
      id,
      userId,
    )
  }

  /**
   * Hard-deletes one of the calling user's saved configurations; 404 when the
   * id does not exist or belongs to another user.
   */
  public async delete(
    id: number,
    userId: number,
  ): Promise<{ deleted: boolean; id: number }> {
    return await this.deleteSavedConfigurationProvider.delete(id, userId)
  }
}
