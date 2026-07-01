import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { isDevelopmentEnvironment } from 'src/common/throttle/is-development.util'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { CreateContactDto } from './dtos/create-contact.dto'
import { ContactProvider } from './providers/contact.provider'
import { ContactSubmission } from './entities/contact-submission.entity'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'

@Controller('contact')
@ApiTags('Contact')
export class ContactController {
  constructor(
    // handles submission persistence and mail notification
    private readonly contactProvider: ContactProvider,
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
    return await this.contactProvider.submit(createContactDto)
  }
}
