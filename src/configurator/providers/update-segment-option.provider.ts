import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { SegmentOption } from '../entities/segment-option.entity'
import { UpdateSegmentOptionDto } from '../dtos/update-segment-option.dto'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class UpdateSegmentOptionProvider {
  private readonly logger = new Logger(UpdateSegmentOptionProvider.name)

  constructor(
    /** inject SegmentOption repository for persistence */
    @InjectRepository(SegmentOption)
    private readonly segmentOptionsRepository: Repository<SegmentOption>,
    /** inject audit log service to record option updates */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Applies a partial update to a segment option. Throws NotFoundException if
   * it doesn't exist, BadRequestException if the new value is the reserved "0"
   * marker, ConflictException if the new value collides with a sibling option.
   */
  public async update(
    optionId: number,
    dto: UpdateSegmentOptionDto,
    activeUserId: number,
  ): Promise<SegmentOption> {
    const option: SegmentOption | null =
      await this.segmentOptionsRepository.findOneBy({ id: optionId })
    if (!option) {
      throw new NotFoundException(
        `Segment option with id ${optionId} not found`,
      )
    }

    if (dto.value === '0') {
      throw new BadRequestException(
        'value "0" is reserved as the universal zero-fill marker',
      )
    }

    option.value = dto.value ?? option.value
    option.label = dto.label ?? option.label
    option.sortOrder = dto.sortOrder ?? option.sortOrder

    try {
      const saved = await this.segmentOptionsRepository.save(option)
      this.logger.log(`Segment option updated — id=${optionId}`)
      await this.auditLogService.log(
        activeUserId,
        AuditAction.UPDATE,
        'SegmentOption',
        optionId,
      )
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'This value is already used by another option on this definition',
        )
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
