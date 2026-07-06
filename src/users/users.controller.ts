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
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { isDevelopmentEnvironment } from 'src/common/throttle/is-development.util'
import { CreateUserDto } from './dtos/create-user.dtos'
import { AdminCreateUserDto } from './dtos/admin-create-user.dto'
import { SetEmailVerifiedDto } from './dtos/set-email-verified.dto'
import { PatchUserDto } from './dtos/patch-user.dto'
import { UsersService } from './providers/users.service'
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import {
  ApiArrayDataResponse,
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { MessageResponseDto } from 'src/common/dto/message-response.dto'
import { AdminUser } from './dto/admin-user.dto'
import { PublicAuthor } from './dto/public-author.dto'
import { AvatarOption } from './entities/avatar-option.entity'
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
import { GetUsersDto } from './dtos/get-users.dto'

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
  @ApiOperation({
    summary:
      'Get all users — supports search, role/verification filters, sort, and pagination',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(AdminUser, {
    description: 'Users fetched successfully',
  })
  public getAllUsers(@Query() dto: GetUsersDto, @Req() request: Request) {
    return this.usersService.findAll(dto, request)
  }

  /**
   * Register a new user — public
   */
  @Auth(AuthType.None)
  @Post()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiDataResponse(AdminUser, { status: 201, description: 'User registered' })
  public createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.craeteUser(createUserDto)
  }

  /**
   * Create multiple users — admin only
   */
  @Roles(UserRole.ADMIN)
  @Post('create-many')
  @ApiOperation({ summary: 'Create multiple users (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiArrayDataResponse(AdminUser, {
    status: 201,
    description: 'The created users',
  })
  public createManyUsers(@Body() createManyUsersDto: CreateManyUsersDto) {
    return this.usersService.createMany(createManyUsersDto)
  }

  /**
   * Create a user with a chosen role and verified status — admin only.
   * Unlike public registration, the admin picks the role directly. If
   * isEmailVerified is left false, the new user still receives the normal
   * verification email.
   */
  @Roles(UserRole.ADMIN)
  @Post('admin')
  @ApiOperation({
    summary:
      'Create a user with a chosen role and verified status (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(AdminUser, { status: 201, description: 'User created' })
  public createUserAsAdmin(
    @Body() adminCreateUserDto: AdminCreateUserDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.adminCreateUser(adminCreateUserDto, activeUserId)
  }

  /**
   * Get the currently authenticated user's own profile.
   * Must be defined before :id to prevent 'me' being parsed as an integer.
   */
  @Get('me')
  @ApiOperation({ summary: "Get the current user's own profile" })
  @ApiAuth()
  @ApiDataResponse(AdminUser)
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
  @ApiArrayDataResponse(AvatarOption, {
    description: 'Array of avatar options',
  })
  public getAvatarOptions() {
    return this.usersService.getAvatarOptions()
  }

  /**
   * Upload a new avatar image and add it as an option — admin only.
   * Sends the file to Cloudinary and saves the url and publicId to the DB.
   */
  @Post('avatar-options')
  @Roles(UserRole.ADMIN)
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiOperation({ summary: 'Add a new avatar option (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiDataResponse(AvatarOption, {
    status: 201,
    description: 'Avatar option created',
  })
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
   * Get a single avatar option by id — public, no auth required.
   */
  @Get('avatar-options/:id')
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a single avatar option by id' })
  @ApiDataResponse(AvatarOption, { description: 'The avatar option' })
  @ApiResponse({ status: 404, description: 'Avatar option not found' })
  public getAvatarOption(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getAvatarOption(id)
  }

  /**
   * Remove an avatar option by id — admin only.
   * Deletes the Cloudinary asset and the DB row.
   */
  @Delete('avatar-options/:id')
  @Roles(UserRole.ADMIN)
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiOperation({ summary: 'Remove an avatar option (admin only)' })
  @ApiDataResponse(MessageResponseDto, { description: 'Avatar option removed' })
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
  @ApiDataResponse(PublicAuthor, { description: 'Public profile' })
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
  @ApiOperation({ summary: 'Get a single user by id (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(AdminUser)
  public getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneById(id)
  }

  /**
   * Update the currently authenticated user's own profile (firstName / lastName / bio).
   * Must be declared before :id to prevent 'me' being parsed as an integer.
   */
  @Patch('me')
  @ApiAuth()
  @ApiOperation({ summary: "Update the current user's profile" })
  @ApiDataResponse(AdminUser, { description: 'Profile updated successfully' })
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
  @ApiAuth()
  @ApiOperation({ summary: 'Select a predefined avatar' })
  @ApiDataResponse(AdminUser, { description: 'Avatar updated successfully' })
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
  @ApiOperation({ summary: "Change a user's role (admin only)" })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(AdminUser, { description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'Cannot target your own account' })
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
   * Set a user's email verification status — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/verify-email')
  @ApiOperation({
    summary: "Set a user's email verification status (admin only)",
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(AdminUser, {
    description: 'Email verification status updated',
  })
  @ApiResponse({ status: 403, description: 'Cannot target your own account' })
  public setEmailVerified(
    @Param('id', ParseIntPipe) id: number,
    @Body() setEmailVerifiedDto: SetEmailVerifiedDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.setEmailVerified(
      id,
      setEmailVerifiedDto.isEmailVerified,
      activeUserId,
    )
  }

  /**
   * Update a user — admin only
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(AdminUser, { description: 'User updated' })
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
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(MessageResponseDto, { description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'Cannot target your own account' })
  public deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.usersService.removeUserById(id, activeUserId)
  }
}
