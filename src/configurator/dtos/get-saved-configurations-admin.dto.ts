import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

class GetSavedConfigurationsAdminBaseDto {
  // quoteReviewed — query param arrives as the string 'true'/'false'. @Type(String) stops the
  // global ValidationPipe's enableImplicitConversion from coercing it to a boolean via
  // Boolean(value) first (which would make 'false' truthy); the explicit @Transform then
  // converts the raw string to a real boolean before validation.
  @ApiPropertyOptional({
    description: 'Filter by whether the quote request has been reviewed',
    example: false,
  })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  quoteReviewed?: boolean
}

// The list is always scoped to rows with a quote request (quoteRequestedAt IS
// NOT NULL) at the provider level — this DTO only adds the reviewed filter on
// top of that base scope.
export class GetSavedConfigurationsAdminDto extends IntersectionType(
  GetSavedConfigurationsAdminBaseDto,
  PaginationQueryDto,
) {}
