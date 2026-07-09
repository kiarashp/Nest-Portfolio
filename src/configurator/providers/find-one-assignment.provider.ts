import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'

@Injectable()
export class FindOneAssignmentProvider {
  constructor(
    /** inject ProductSegmentAssignment repository */
    @InjectRepository(ProductSegmentAssignment)
    private readonly assignmentsRepository: Repository<ProductSegmentAssignment>,
  ) {}

  /**
   * Returns one assignment with its own definition and every sibling
   * assignment in the same product (each with its definition), ordered by
   * position — everything the update/delete providers' business-rule checks
   * need (direction rule, operator×dataType matrix, dependent lookup) in a
   * single query. Throws NotFoundException if the assignment doesn't exist.
   */
  public async findOneByIdOrFail(
    id: number,
  ): Promise<ProductSegmentAssignment> {
    let assignment: ProductSegmentAssignment | null = null
    try {
      assignment = await this.assignmentsRepository.findOne({
        where: { id },
        relations: {
          definition: true,
          product: { assignments: { definition: true } },
        },
        order: { product: { assignments: { position: 'ASC' } } },
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
    if (!assignment) {
      throw new NotFoundException(`Assignment with id ${id} not found`)
    }
    return assignment
  }
}
