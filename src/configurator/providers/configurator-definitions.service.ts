import { Injectable } from '@nestjs/common'
import { Request } from 'express'
import { CreateSegmentDefinitionProvider } from './create-segment-definition.provider'
import { FindAllSegmentDefinitionsProvider } from './find-all-segment-definitions.provider'
import { FindOneSegmentDefinitionProvider } from './find-one-segment-definition.provider'
import { UpdateSegmentDefinitionProvider } from './update-segment-definition.provider'
import { DeleteSegmentDefinitionProvider } from './delete-segment-definition.provider'
import { CreateSegmentOptionProvider } from './create-segment-option.provider'
import { UpdateSegmentOptionProvider } from './update-segment-option.provider'
import { DeleteSegmentOptionProvider } from './delete-segment-option.provider'
import { CreateSegmentDefinitionDto } from '../dtos/create-segment-definition.dto'
import { UpdateSegmentDefinitionDto } from '../dtos/update-segment-definition.dto'
import { GetSegmentDefinitionsDto } from '../dtos/get-segment-definitions.dto'
import { CreateSegmentOptionDto } from '../dtos/create-segment-option.dto'
import { UpdateSegmentOptionDto } from '../dtos/update-segment-option.dto'

/**
 * Thin facade over the segment-definition and segment-option providers, one
 * method per route. Mirrors TagsService/ProductTypesService.
 */
@Injectable()
export class ConfiguratorDefinitionsService {
  constructor(
    private readonly createSegmentDefinitionProvider: CreateSegmentDefinitionProvider,
    private readonly findAllSegmentDefinitionsProvider: FindAllSegmentDefinitionsProvider,
    private readonly findOneSegmentDefinitionProvider: FindOneSegmentDefinitionProvider,
    private readonly updateSegmentDefinitionProvider: UpdateSegmentDefinitionProvider,
    private readonly deleteSegmentDefinitionProvider: DeleteSegmentDefinitionProvider,
    private readonly createSegmentOptionProvider: CreateSegmentOptionProvider,
    private readonly updateSegmentOptionProvider: UpdateSegmentOptionProvider,
    private readonly deleteSegmentOptionProvider: DeleteSegmentOptionProvider,
  ) {}

  public create(dto: CreateSegmentDefinitionDto, activeUserId: number) {
    return this.createSegmentDefinitionProvider.create(dto, activeUserId)
  }

  public findAll(dto: GetSegmentDefinitionsDto, request: Request) {
    return this.findAllSegmentDefinitionsProvider.findAll(dto, request)
  }

  public findOne(id: number) {
    return this.findOneSegmentDefinitionProvider.findOneByIdOrFail(id)
  }

  public update(
    id: number,
    dto: UpdateSegmentDefinitionDto,
    activeUserId: number,
  ) {
    return this.updateSegmentDefinitionProvider.update(id, dto, activeUserId)
  }

  public delete(id: number, activeUserId: number) {
    return this.deleteSegmentDefinitionProvider.delete(id, activeUserId)
  }

  public createOption(
    definitionId: number,
    dto: CreateSegmentOptionDto,
    activeUserId: number,
  ) {
    return this.createSegmentOptionProvider.create(
      definitionId,
      dto,
      activeUserId,
    )
  }

  public updateOption(
    optionId: number,
    dto: UpdateSegmentOptionDto,
    activeUserId: number,
  ) {
    return this.updateSegmentOptionProvider.update(optionId, dto, activeUserId)
  }

  public deleteOption(optionId: number, activeUserId: number) {
    return this.deleteSegmentOptionProvider.delete(optionId, activeUserId)
  }
}
