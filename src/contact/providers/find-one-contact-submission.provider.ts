import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContactSubmission } from '../entities/contact-submission.entity'

@Injectable()
export class FindOneContactSubmissionProvider {
  constructor(
    /**
     * inject `ContactSubmission` repository
     */
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionRepository: Repository<ContactSubmission>,
  ) {}

  /**
   * Returns the submission or null if not found. Use when the caller needs to
   * decide what to do with a missing submission.
   */
  public async findOneById(id: number): Promise<ContactSubmission | null> {
    try {
      return await this.contactSubmissionRepository.findOneBy({ id })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
      )
    }
  }

  /**
   * Returns the submission or throws NotFoundException. Use when a missing
   * submission is always an error (the single-read and update endpoints).
   */
  public async findOneByIdOrFail(id: number): Promise<ContactSubmission> {
    const submission = await this.findOneById(id)
    if (!submission) {
      throw new NotFoundException(`Contact submission with ID ${id} not found`)
    }
    return submission
  }
}
