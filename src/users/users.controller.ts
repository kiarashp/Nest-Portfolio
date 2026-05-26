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

@Controller('users')
export class UsersController {
  // GET ALL Users
  @Get()
  public getAllUsers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return `This action returns all users ${limit} ${page}`
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
    return `This action returns user ${id}`
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
