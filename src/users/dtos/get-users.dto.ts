import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { UserRole } from 'src/auth/enums/user-role.enum'

/** Columns GET /users can sort by. User has no createdAt column, so id stands in for registration order. */
export const USER_SORT_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'role',
] as const
export type UserSortField = (typeof USER_SORT_FIELDS)[number]

/** Sort directions accepted alongside sortBy. */
export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export class GetUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Keyword search across first name, last name, and email',
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by role — exact match',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  // isEmailVerified — query param arrives as the string 'true'/'false'. @Type(String) stops the
  // global ValidationPipe's enableImplicitConversion from coercing it to a boolean via
  // Boolean(value) first (which would make 'false' truthy); the explicit @Transform then
  // converts the raw string to a real boolean before validation.
  @ApiPropertyOptional({
    description: 'Filter by email verification status',
    example: true,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: USER_SORT_FIELDS,
    default: 'id',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SORT_ORDERS,
    default: 'asc',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder
}
