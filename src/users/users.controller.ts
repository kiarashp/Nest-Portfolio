import {
  Controller,
  Get,
  NotFoundException,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  Patch,
  Delete,
  SerializeOptions,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { Throttle } from '@nestjs/throttler'
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
import { PatchUserProfileDto } from './dtos/patch-user-profile.dto'
import { SelectAvatarDto } from './dtos/select-avatar.dto'
import type { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

@Controller('users')
@ApiTags('Users')
// activates the 'admin' group so email and role are included in all responses from this controller
@SerializeOptions({ groups: ['admin'] })
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
  public getAllUsers(@Query() paginationQuery: PaginationQueryDto) {
    return this.usersService.findAll(paginationQuery)
  }

  /**
   * Register a new user — public
   */
  @Auth(AuthType.None)
  @Post()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
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
   * Get the currently authenticated user's own profile.
   * Must be defined before :id to prevent 'me' being parsed as an integer.
   */
  @Get('me')
  public getMe(@ActiveUser() activeUser: ActiveUserData) {
    return this.usersService.findOneById(activeUser.sub)
  }

  /**
   * List all available predefined avatars — public, no auth required.
   * Frontend and Flutter (or mobile app) use this to render the avatar picker.
   */
  @Get('avatar-options')
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'List available predefined avatar options' })
  @ApiResponse({ status: 200, description: 'Array of avatar options' })
  public getAvatarOptions() {
    return this.usersService.getAvatarOptions()
  }

  /**
   * Upload a new avatar image and add it as an option — admin only.
   * Sends the file to Cloudinary and saves the url and publicId to the DB.
   */
  @Post('avatar-options')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new avatar option (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar option created' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  public async createAvatarOption(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.createAvatarOption(file, activeUserId)
  }

  /**
   * Remove an avatar option by id — admin only.
   * Deletes the Cloudinary asset and the DB row.
   */
  @Delete('avatar-options/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an avatar option (admin only)' })
  @ApiResponse({ status: 200, description: 'Avatar option removed' })
  @ApiResponse({ status: 404, description: 'Option not found' })
  public async removeAvatarOption(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.removeAvatarOption(id, activeUserId)
  }

  /**
   * Public profile for a content author, editor, or admin.
   * Returns 404 for USER-role accounts so regular sign-ups are not publicly discoverable.
   * Uses the 'public' group to override the class-level 'admin' group, hiding email/role/isEmailVerified.
   */
  @Get(':id/profile')
  @Auth(AuthType.None)
  @SerializeOptions({ groups: ['public'] })
  @ApiOperation({
    summary: 'Get public profile for a content author or editor',
  })
  @ApiResponse({ status: 200, description: 'Public profile' })
  @ApiResponse({
    status: 404,
    description: 'Not found or user is not a content author',
  })
  public async getPublicProfile(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOneById(id)
    // Return 404 for USER-role accounts — don't reveal regular user accounts exist
    if (user.role === UserRole.USER)
      throw new NotFoundException('User not found')
    return user
  }

  /**
   * Get a single user by id — admin only
   */
  @Roles(UserRole.ADMIN)
  @Get(':id')
  public getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneById(id)
  }

  /**
   * Update the currently authenticated user's own profile (firstName / lastName / bio).
   * Must be declared before :id to prevent 'me' being parsed as an integer.
   */
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update the current user's profile" })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  public updateMe(
    @ActiveUser() activeUser: ActiveUserData,
    @Body() patchUserProfileDto: PatchUserProfileDto,
  ) {
    return this.usersService.patchUserProfile(
      activeUser.sub,
      patchUserProfileDto,
    )
  }

  /**
   * Select a predefined avatar for the currently logged-in user.
   */
  @Patch('avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select a predefined avatar' })
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @ApiResponse({ status: 400, description: 'Unknown avatar option id' })
  public async selectAvatar(
    @Body() dto: SelectAvatarDto,
    @ActiveUser('sub') userId: number,
  ) {
    return await this.usersService.selectAvatar(dto.avatarOptionId, userId)
  }

  /**
   * Change a user's role — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/role')
  public changeUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() changeUserRoleDto: ChangeUserRoleDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.changeUserRole(
      id,
      changeUserRoleDto.role,
      activeUserId,
    )
  }

  /**
   * Update a user — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  public updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() patchUserDto: PatchUserDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.patchUser(id, patchUserDto, activeUserId)
  }

  /**
   * Delete a user — admin only
   */
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  public deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.removeUserById(id, activeUserId)
  }
}
