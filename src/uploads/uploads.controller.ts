import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { UploadsService } from './providers/uploads.service'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'

/**
 * Handles HTTP requests for uploading files (currently images) to Cloudinary.
 */
@Controller('uploads')
@ApiTags('Uploads')
@ApiBearerAuth()
export class UploadsController {
  constructor(
    /**
     * inject `UploadsService`
     */
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * Uploads a single image file and stores its metadata in the database.
   */
  @ApiOperation({
    summary: 'Upload an image file',
    description:
      'Uploads an image (jpeg, png, webp or gif, max 5MB) to Cloudinary and saves its metadata.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'The file has been successfully uploaded',
  })
  @ApiResponse({
    status: 400,
    description:
      'The file is missing, too large, or not a supported image type',
  })
  @ApiResponse({
    status: 409,
    description: 'The upload to Cloudinary or saving the file record failed',
  })
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  public async uploadFile(
    // The uploaded file, rejected with a 400 if missing, over 5MB, or not an allowed image type.
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    // Id of the logged-in user, read from the JWT payload's `sub` claim.
    @ActiveUser('sub') userId: number,
  ) {
    return await this.uploadsService.uploadFile(file, userId)
  }
}
