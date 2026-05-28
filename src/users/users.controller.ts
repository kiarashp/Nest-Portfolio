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
} from '@nestjs/common'
import { CreateUserDto } from './dtos/create-user.dtos'
import { PatchUserDto } from './dtos/patch-user.dto'
import { UsersService } from './providers/users.service'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

@Controller('users')
@ApiTags('Users')
export class UsersController {
  // Injecting UsersService
  constructor(private usersService: UsersService) {}

  // GET ALL Users
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
  // CREATE ONE User
  @Post()
  public createUser(@Body() createUserDto: CreateUserDto) {
    console.log(createUserDto)
  }
  // GET ONE User
  @Get(':id')
  public getUser(@Param('id', ParseIntPipe) id: number) {
    console.log(id)
    return this.usersService.findOneById(id)
  }
  // UPDATE ONE User
  @Patch(':id')
  public updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() patchUserDto: PatchUserDto,
  ) {
    console.log(patchUserDto)
    return `This action updates user`
  }

  // DELETE ONE User
  @Delete(':id')
  public deleteUser(@Param('id', ParseIntPipe) id: number) {
    console.log(id)
    return `This action deletes user ${id}`
  }
}
