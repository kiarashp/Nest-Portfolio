import { PartialType } from '@nestjs/mapped-types'
import { CreateUserDto } from './create-user.dtos'
export class PatchUserDto extends PartialType(CreateUserDto) {}
