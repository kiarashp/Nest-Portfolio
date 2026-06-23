import { Injectable } from '@nestjs/common'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { MetaOption } from '../entities/meta-option.entity'
import { UpdateMetaOptionDto } from '../dto/update-meta-option.dto'
import { FindOneMetaOptionProvider } from '../providers/find-one-meta-option.provider'
import { UpdateMetaOptionProvider } from '../providers/update-meta-option.provider'
import { DeleteMetaOptionProvider } from '../providers/delete-meta-option.provider'

@Injectable()
export class MetaOptionsService {
  constructor(
    /** inject find-one provider */
    private readonly findOneMetaOptionProvider: FindOneMetaOptionProvider,
    /** inject update provider */
    private readonly updateMetaOptionProvider: UpdateMetaOptionProvider,
    /** inject delete provider */
    private readonly deleteMetaOptionProvider: DeleteMetaOptionProvider,
  ) {}

  /** Returns a MetaOption by ID. Throws 404 if not found. */
  public findOne(id: number): Promise<MetaOption> {
    return this.findOneMetaOptionProvider.findOneById(id)
  }

  /** Updates a MetaOption. Throws 403 if the caller does not own the linked post. */
  public update(
    id: number,
    updateMetaOptionDto: UpdateMetaOptionDto,
    activeUser: ActiveUserData,
  ): Promise<MetaOption> {
    return this.updateMetaOptionProvider.update(
      id,
      updateMetaOptionDto,
      activeUser,
    )
  }

  /** Deletes a MetaOption. Throws 403 if the caller does not own the linked post. */
  public delete(
    id: number,
    activeUser: ActiveUserData,
  ): Promise<{ deleted: boolean; id: number }> {
    return this.deleteMetaOptionProvider.delete(id, activeUser)
  }
}
