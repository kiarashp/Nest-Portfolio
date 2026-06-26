import { PartialType } from '@nestjs/swagger'
import { CreateUserDto } from './create-user.dtos'
export class PatchUserDto extends PartialType(CreateUserDto) {}
