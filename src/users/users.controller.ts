import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Ip,
} from '@nestjs/common'

@Controller('users')
export class UsersController {
  @Get()
  public findAll() {
    return 'This action returns all users'
  }

  @Get(':id/:optional?')
  public getUsers(@Param('id') id: any, @Query('limit') limit: any) {
    console.log(id)
    console.log(limit)
    return `This action returns user ${id}`
  }

  @Post()
  public create(@Body() body: any, @Headers() headers: any, @Ip() ip: any) {
    console.log(headers)
    console.log(ip)
    return `This action creates a new user ${body}`
  }
}
