import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { CreateContactDto } from './dtos/create-contact.dto'
import { ContactProvider } from './providers/contact.provider'

@Controller('contact')
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
  @HttpCode(HttpStatus.CREATED)
  @Post()
  public async submit(@Body() createContactDto: CreateContactDto) {
    return await this.contactProvider.submit(createContactDto)
  }
}
