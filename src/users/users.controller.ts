import {
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { CreateUserDto } from './dtos/create-user.dtos'
import { PatchUserDto } from './dtos/patch-user.dto'
import { UsersService } from './providers/users.service'
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { CreateManyUsersDto } from './dtos/create-many-users.dto'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

@Controller('users')
@ApiTags('Users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  // Injecting UsersService
  constructor(private usersService: UsersService) {}

  /**
   * Get all users
   */
  @Get()
  @ApiOperation({ summary: 'Get all users with pagination and limit' })
  @ApiResponse({
    status: 200,
    description: 'Users fetched successfully based on limit and page',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Limit number',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number',
    example: 1,
  })
  public getAllUsers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.usersService.findAll(limit, page)
  }
  /**
   * Create a User
   */
  @Post()
  @Auth(AuthType.None)
  public createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.craeteUser(createUserDto)
  }
  /**
   * Create multiple Users
   */
  @Post('create-many')
  public createManyUsers(@Body() createManyUsersDto: CreateManyUsersDto) {
    return this.usersService.createMany(createManyUsersDto)
  }
  /**
   * GET ONE User
   */
  @Get(':id')
  public getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneById(id)
  }

  /**
   * Upload or replace the avatar for the currently logged-in user.
   * The file is stored under users/<userId>/ in the storage backend.
   */
  @Patch('avatar')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload user avatar',
    description:
      'Uploads an image (jpeg, png, webp or gif, max 5MB) and sets it as the avatar for the authenticated user.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'File is missing, too large, or not a supported image type',
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  public async uploadAvatar(
    // The uploaded image file, validated for size (5MB) and type (jpeg/png/webp/gif).
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
    return await this.usersService.uploadAvatar(file, userId)
  }
  /**
   * UPDATE ONE User
   */
  @Patch(':id')
  public updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() patchUserDto: PatchUserDto,
  ) {
    return `This action updates user`
  }
  /**
   * DELETE ONE User
   */
  @Delete(':id')
  public deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeUserById(id)
  }
}
