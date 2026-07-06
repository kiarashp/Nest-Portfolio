import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { isDevelopmentEnvironment } from 'src/common/throttle/is-development.util'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import { CreateContactDto } from './dtos/create-contact.dto'
import { GetContactSubmissionsDto } from './dtos/get-contact-submissions.dto'
import { PatchContactSubmissionDto } from './dtos/patch-contact-submission.dto'
import { ContactService } from './providers/contact.service'
import { ContactSubmission } from './entities/contact-submission.entity'
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'

@Controller('contact')
@ApiTags('Contact')
export class ContactController {
  constructor(
    // handles submission persistence, mail notification, and admin reads/writes
    private readonly contactService: ContactService,
  ) {}

  /**
   * submit a contact form message — public, throttled to 3 submissions per 5 minutes per IP
   */
  @Auth(AuthType.None)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiOperation({ summary: 'Submit a contact form message' })
  @ApiDataResponse(ContactSubmission, {
    status: 201,
    description: 'Submission received and persisted',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (throttled to 3 per 5 minutes per IP)',
  })
  public async submit(@Body() createContactDto: CreateContactDto) {
    return await this.contactService.submit(createContactDto)
  }

  /**
   * list contact submissions — admin only, paginated, filterable by handled and date range
   */
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List contact submissions (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(ContactSubmission)
  public async findAll(
    @Query() dto: GetContactSubmissionsDto,
    @Req() request: Request,
  ) {
    return await this.contactService.findAll(dto, request)
  }

  /**
   * get a single contact submission by id — admin only
   */
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get a contact submission by ID (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ContactSubmission)
  @ApiResponse({ status: 404, description: 'Contact submission not found' })
  public async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.contactService.findOne(id)
  }

  /**
   * toggle the handled flag on a contact submission — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Toggle the handled flag on a contact submission (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ContactSubmission)
  @ApiResponse({ status: 404, description: 'Contact submission not found' })
  public async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchContactSubmissionDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return await this.contactService.update(id, dto, activeUserId)
  }
}
