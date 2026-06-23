import { Controller } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { UploadsService } from './providers/uploads.service'

/**
 * Handles HTTP requests for managing uploaded files.
 */
@Controller('uploads')
@ApiTags('Uploads')
@ApiBearerAuth()
export class UploadsController {
  constructor(
    /** inject `UploadsService` */
    private readonly uploadsService: UploadsService,
  ) {}
}
