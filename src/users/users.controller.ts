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
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ChangeUserRoleDto } from './dtos/change-user-role.dto'

@Controller('users')
@ApiTags('Users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Get all users — admin only
   */
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get all users with pagination and limit' })
  @ApiResponse({ status: 200, description: 'Users fetched successfully' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  public getAllUsers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.usersService.findAll(limit, page)
  }

  /**
   * Register a new user — public
   */
  @Auth(AuthType.None)
  @Post()
  public createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.craeteUser(createUserDto)
  }

  /**
   * Create multiple users — admin only
   */
  @Roles(UserRole.ADMIN)
  @Post('create-many')
  public createManyUsers(@Body() createManyUsersDto: CreateManyUsersDto) {
    return this.usersService.createMany(createManyUsersDto)
  }

  /**
   * Get a single user by id
   */
  @Get(':id')
  public getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneById(id)
  }

  /**
   * Upload or replace the avatar for the currently logged-in user.
   */
  @Patch('avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'File is missing, too large, or not a supported image type',
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  public async uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @ActiveUser('sub') userId: number,
  ) {
    return await this.usersService.uploadAvatar(file, userId)
  }

  /**
   * Change a user's role — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/role')
  public changeUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() changeUserRoleDto: ChangeUserRoleDto,
  ) {
    return this.usersService.changeUserRole(id, changeUserRoleDto.role)
  }

  /**
   * Update a user — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  public updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() patchUserDto: PatchUserDto,
  ) {
    return `This action updates user`
  }

  /**
   * Delete a user — admin only
   */
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  public deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeUserById(id)
  }
}
