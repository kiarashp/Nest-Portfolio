import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ConfiguratorsService } from './providers/configurators.service'
import { ConfiguratorFormSchemaDto } from './dtos/configurator-form-schema.dto'
import { ResolveConfigurationDto } from './dtos/resolve-configuration.dto'
import { ResolveResultDto } from './dtos/resolve-result.dto'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'

/**
 * Public configurator endpoints (CONFIGURATOR.md §5.2, §7 Step 5): guests and
 * customers fetch a published configurator's form schema and resolve their
 * selections into an ordering code. Both routes are unauthenticated; the
 * global throttle default is sufficient, so there is no per-route @Throttle.
 */
@ApiTags('Configurators (public)')
@Controller('configurators')
export class ConfiguratorsController {
  constructor(private readonly configuratorsService: ConfiguratorsService) {}

  /**
   * get the public form schema for a published configurator by slug —
   * unpublished or soft-deleted products 404
   */
  @Auth(AuthType.None)
  @ApiOperation({
    summary: 'Get the public configurator form schema by slug',
  })
  @ApiDataResponse(ConfiguratorFormSchemaDto)
  @ApiResponse({
    status: 404,
    description: 'Configurator not found or not published',
  })
  @Get(':slug')
  public getFormSchema(@Param('slug') slug: string) {
    return this.configuratorsService.getFormSchema(slug)
  }

  /**
   * resolve selections into an ordering code + human summary — stateless,
   * returns 200 (a computed result, not a created resource)
   */
  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve selections into an ordering code and summary',
  })
  @ApiDataResponse(ResolveResultDto)
  @ApiResponse({ status: 400, description: 'Malformed selections object' })
  @ApiResponse({
    status: 404,
    description: 'Configurator not found or not published',
  })
  @Post(':slug/resolve')
  public resolve(
    @Param('slug') slug: string,
    @Body() dto: ResolveConfigurationDto,
  ) {
    return this.configuratorsService.resolve(slug, dto)
  }
}
