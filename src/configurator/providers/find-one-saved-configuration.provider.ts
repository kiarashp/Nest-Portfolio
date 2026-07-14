import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SavedConfiguration } from '../entities/saved-configuration.entity'

@Injectable()
export class FindOneSavedConfigurationProvider {
  constructor(
    /** inject SavedConfiguration repository for lookups */
    @InjectRepository(SavedConfiguration)
    private readonly savedConfigurationsRepository: Repository<SavedConfiguration>,
  ) {}

  /**
   * Returns one saved configuration owned by the given user. The query is
   * scoped by owner, so a snapshot belonging to someone else 404s exactly
   * like a missing id — CONFIGURATOR.md §5.3 wants 404, not 403, so a caller
   * can never probe whether an id exists.
   */
  public async findOneOwnedOrFail(
    id: number,
    userId: number,
  ): Promise<SavedConfiguration> {
    const savedConfiguration = await this.savedConfigurationsRepository.findOne(
      {
        where: { id, userId },
      },
    )
    if (!savedConfiguration) {
      throw new NotFoundException(`Saved configuration ${id} not found`)
    }
    return savedConfiguration
  }

  /**
   * Returns one saved configuration by id, regardless of owner — used by the
   * admin quote-request inbox, which is deliberately unscoped unlike
   * findOneOwnedOrFail above.
   */
  public async findOneByIdOrFail(id: number): Promise<SavedConfiguration> {
    const savedConfiguration =
      await this.savedConfigurationsRepository.findOneBy({ id })
    if (!savedConfiguration) {
      throw new NotFoundException(`Saved configuration ${id} not found`)
    }
    return savedConfiguration
  }
}
