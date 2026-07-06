import { Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { CreateContactDto } from '../dtos/create-contact.dto'
import { GetContactSubmissionsDto } from '../dtos/get-contact-submissions.dto'
import { PatchContactSubmissionDto } from '../dtos/patch-contact-submission.dto'
import { ContactSubmission } from '../entities/contact-submission.entity'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { SubmitContactProvider } from './submit-contact.provider'
import { FindAllContactSubmissionsProvider } from './find-all-contact-submissions.provider'
import { FindOneContactSubmissionProvider } from './find-one-contact-submission.provider'
import { UpdateContactSubmissionProvider } from './update-contact-submission.provider'

@Injectable()
export class ContactService {
  constructor(
    /**
     * inject submit contact provider
     */
    private readonly submitContactProvider: SubmitContactProvider,
    /**
     * inject find all contact submissions provider
     */
    private readonly findAllContactSubmissionsProvider: FindAllContactSubmissionsProvider,
    /**
     * inject find one contact submission provider
     */
    private readonly findOneContactSubmissionProvider: FindOneContactSubmissionProvider,
    /**
     * inject update contact submission provider
     */
    private readonly updateContactSubmissionProvider: UpdateContactSubmissionProvider,
  ) {}

  public async submit(dto: CreateContactDto): Promise<ContactSubmission> {
    return await this.submitContactProvider.submit(dto)
  }

  public async findAll(
    dto: GetContactSubmissionsDto,
    request: Request,
  ): Promise<Paginated<ContactSubmission>> {
    return await this.findAllContactSubmissionsProvider.findAll(dto, request)
  }

  public async findOne(id: number): Promise<ContactSubmission> {
    return await this.findOneContactSubmissionProvider.findOneByIdOrFail(id)
  }

  public async update(
    id: number,
    dto: PatchContactSubmissionDto,
    activeUserId: number,
  ): Promise<ContactSubmission> {
    return await this.updateContactSubmissionProvider.update(
      id,
      dto,
      activeUserId,
    )
  }
}
