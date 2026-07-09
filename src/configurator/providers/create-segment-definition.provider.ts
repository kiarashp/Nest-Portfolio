import {
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { SegmentDefinition } from '../entities/segment-definition.entity'
import { CreateSegmentDefinitionDto } from '../dtos/create-segment-definition.dto'
import { validateSegmentConstraints } from './validate-segment-constraints.util'
import { AuditLogService } from 'src/audit-log/providers/audit-log.service'
import { AuditAction } from 'src/audit-log/enums/audit-action.enum'

@Injectable()
export class CreateSegmentDefinitionProvider {
  private readonly logger = new Logger(CreateSegmentDefinitionProvider.name)

  constructor(
    /** inject SegmentDefinition repository for persistence */
    @InjectRepository(SegmentDefinition)
    private readonly segmentDefinitionsRepository: Repository<SegmentDefinition>,
    /** inject audit log service to record definition creation */
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new segment definition. Throws BadRequestException if constraints
   * don't match the declared dataType's shape, ConflictException if the name is
   * already in use.
   */
  public async create(
    dto: CreateSegmentDefinitionDto,
    activeUserId: number,
  ): Promise<SegmentDefinition> {
    const constraints = validateSegmentConstraints(
      dto.dataType,
      dto.constraints,
    )

    const definition = this.segmentDefinitionsRepository.create({
      ...dto,
      constraints,
    })

    try {
      const saved = await this.segmentDefinitionsRepository.save(definition)
      this.logger.log(
        `Segment definition created — id=${saved.id}, name=${saved.name}`,
      )
      await this.auditLogService.log(
        activeUserId,
        AuditAction.CREATE,
        'SegmentDefinition',
        saved.id,
      )
      return saved
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Segment definition name already in use')
      }
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }
}
