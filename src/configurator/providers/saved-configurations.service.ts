import { Injectable } from '@nestjs/common'
import { Request } from 'express'
import { SavedConfiguration } from '../entities/saved-configuration.entity'
import { ResolveConfigurationDto } from '../dtos/resolve-configuration.dto'
import { GetSavedConfigurationsDto } from '../dtos/get-saved-configurations.dto'
import { GetSavedConfigurationsAdminDto } from '../dtos/get-saved-configurations-admin.dto'
import { PatchSavedConfigurationReviewedDto } from '../dtos/patch-saved-configuration-reviewed.dto'
import { SaveConfigurationProvider } from './save-configuration.provider'
import { FindMySavedConfigurationsProvider } from './find-my-saved-configurations.provider'
import { FindOneSavedConfigurationProvider } from './find-one-saved-configuration.provider'
import { DeleteSavedConfigurationProvider } from './delete-saved-configuration.provider'
import { RequestQuoteSavedConfigurationProvider } from './request-quote-saved-configuration.provider'
import { FindAllSavedConfigurationsAdminProvider } from './find-all-saved-configurations-admin.provider'
import { ReviewSavedConfigurationProvider } from './review-saved-configuration.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

// Thin facade for saved configurations (CONFIGURATOR.md §5.3, Phase 2):
// frozen snapshots of resolved configurations owned by registered users.
// Most operations are scoped to the calling user; the findAllAdmin/
// findOneAdmin/reviewAdmin methods back the admin-only quote-request inbox,
// which is deliberately unscoped by owner.
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
    // owner-scoped quote request — stamps quoteRequestedAt and emits the mail event
    private readonly requestQuoteSavedConfigurationProvider: RequestQuoteSavedConfigurationProvider,
    // admin-only: paginated list of quote requests across all users
    private readonly findAllSavedConfigurationsAdminProvider: FindAllSavedConfigurationsAdminProvider,
    // admin-only: toggles the quoteReviewed flag on a quote request
    private readonly reviewSavedConfigurationProvider: ReviewSavedConfigurationProvider,
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

  /**
   * Marks a quote as requested for one of the calling user's saved
   * configurations; 404 when the id does not exist or belongs to another
   * user, 409 if a quote was already requested.
   */
  public async requestQuote(
    id: number,
    userId: number,
  ): Promise<SavedConfiguration> {
    return await this.requestQuoteSavedConfigurationProvider.requestQuote(
      id,
      userId,
    )
  }

  /**
   * Admin-only: returns a paginated list of quote requests across all users,
   * newest request first. Scoped to rows where a quote was actually
   * requested (quoteRequestedAt IS NOT NULL).
   */
  public async findAllAdmin(
    dto: GetSavedConfigurationsAdminDto,
    request: Request,
  ): Promise<Paginated<SavedConfiguration>> {
    return await this.findAllSavedConfigurationsAdminProvider.findAll(
      dto,
      request,
    )
  }

  /**
   * Admin-only: returns one saved configuration by id, regardless of owner;
   * 404 when the id does not exist.
   */
  public async findOneAdmin(id: number): Promise<SavedConfiguration> {
    return await this.findOneSavedConfigurationProvider.findOneByIdOrFail(id)
  }

  /**
   * Admin-only: toggles the quoteReviewed flag on a saved configuration's
   * quote request; 404 when the id does not exist.
   */
  public async reviewAdmin(
    id: number,
    dto: PatchSavedConfigurationReviewedDto,
    activeUserId: number,
  ): Promise<SavedConfiguration> {
    return await this.reviewSavedConfigurationProvider.review(
      id,
      dto,
      activeUserId,
    )
  }
}
