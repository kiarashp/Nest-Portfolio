import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsJWT, IsOptional, IsString } from 'class-validator'

export class RefreshTokenDto {
  // Optional at the DTO level so the global ValidationPipe does not reject
  // browser requests that carry no body (they supply the token via HttpOnly
  // cookie instead). The controller enforces that at least one source is present.
  @ApiPropertyOptional({
    description:
      'Refresh token (mobile clients only — browser clients use the HttpOnly cookie)',
  })
  @IsOptional()
  @IsString()
  @IsJWT()
  refreshToken?: string
}
