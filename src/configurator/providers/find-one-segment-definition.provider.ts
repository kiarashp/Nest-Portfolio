import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SegmentDefinition } from '../entities/segment-definition.entity'

@Injectable()
export class FindOneSegmentDefinitionProvider {
  constructor(
    /** inject SegmentDefinition repository */
    @InjectRepository(SegmentDefinition)
    private readonly segmentDefinitionsRepository: Repository<SegmentDefinition>,
  ) {}

  /**
   * Returns a segment definition with its options (ordered by sortOrder), or
   * throws NotFoundException. Used by the single-record read and by the update/
   * delete providers to load the definition before mutating it.
   */
  public async findOneByIdOrFail(id: number): Promise<SegmentDefinition> {
    let definition: SegmentDefinition | null = null
    try {
      definition = await this.segmentDefinitionsRepository.findOne({
        where: { id },
        relations: { options: true },
        order: { options: { sortOrder: 'ASC' } },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!definition) {
      throw new NotFoundException(`Segment definition with id ${id} not found`)
    }
    return definition
  }
}
