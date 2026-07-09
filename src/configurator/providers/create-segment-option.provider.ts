import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { SegmentOption } from '../entities/segment-option.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { CreateSegmentOptionDto } from '../dtos/create-segment-option.dto'
import { FindOneSegmentDefinitionProvider } from './find-one-segment-definition.provider'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateSegmentOptionProvider {
  private readonly logger = new Logger(CreateSegmentOptionProvider.name)

  constructor(
    /** inject SegmentOption repository for persistence */
    @InjectRepository(SegmentOption)
    private readonly segmentOptionsRepository: Repository<SegmentOption>,
    /** inject find-one provider to load the parent definition first */
    private readonly findOneSegmentDefinitionProvider: FindOneSegmentDefinitionProvider,
    /** inject audit log service to record option creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a SegmentOption under a SELECT segment definition. Throws
   * NotFoundException if the definition doesn't exist, BadRequestException if
   * the definition isn't SELECT or the value is the reserved "0" marker, and
   * ConflictException if the value is already used by another option on the
   * same definition.
   */
  public async create(
    definitionId: number,
    dto: CreateSegmentOptionDto,
    activeUserId: number,
  ): Promise<SegmentOption> {
    const definition =
      await this.findOneSegmentDefinitionProvider.findOneByIdOrFail(
        definitionId,
      )

    if (definition.dataType !== SegmentDataType.SELECT) {
      throw new BadRequestException(
        'Segment options can only be added to a SELECT definition',
      )
    }

    if (dto.value === '0') {
      throw new BadRequestException(
        'value "0" is reserved as the universal zero-fill marker',
      )
    }

    const option = this.segmentOptionsRepository.create({
      ...dto,
      definitionId,
    })

    try {
      const saved = await this.segmentOptionsRepository.save(option)
      this.logger.log(
        `Segment option created — id=${saved.id}, definitionId=${definitionId}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.CREATE,
        'SegmentOption',
        saved.id,
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
