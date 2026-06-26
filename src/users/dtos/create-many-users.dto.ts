import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { CreateUserDto } from './create-user.dtos'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class CreateManyUsersDto {
  @ApiProperty({ type: () => CreateUserDto, isArray: true })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserDto)
  users!: CreateUserDto[]
}
