import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common'
import { CreateUserDto } from './dtos/create-user.dtos'
import { PatchUserDto } from './dtos/patch-user.dto'
import { UsersService } from './providers/users.service'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CreateManyUsersDto } from './dtos/create-many-users.dto'
import { AccessTokenGuard } from 'src/auth/guards/access-token/access-token.guard'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { Auth } from 'src/auth/decorators/auth.decorator'

@Controller('users')
@ApiTags('Users')
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
  @UseInterceptors(ClassSerializerInterceptor)
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
