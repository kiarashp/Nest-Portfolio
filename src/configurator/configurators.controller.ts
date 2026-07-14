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
import { SavedConfigurationsService } from './providers/saved-configurations.service'
import { ConfiguratorFormSchemaDto } from './dtos/configurator-form-schema.dto'
import { ConfiguratorListItemDto } from './dtos/configurator-list-item.dto'
import { ResolveConfigurationDto } from './dtos/resolve-configuration.dto'
import { ResolveResultDto } from './dtos/resolve-result.dto'
import { SavedConfiguration } from './entities/saved-configuration.entity'
import {
  ApiArrayDataResponse,
  ApiDataResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

/**
 * Customer-facing configurator endpoints (CONFIGURATOR.md §5.2/§5.3, §7
 * Steps 5–6): guests and customers fetch a published configurator's form
 * schema and resolve their selections into an ordering code — both
 * unauthenticated — while registered users can additionally save a frozen
 * snapshot of a valid resolve (Bearer-only). The global throttle default is
 * sufficient, so there is no per-route @Throttle.
 */
@ApiTags('Configurators (public)')
@Controller('configurators')
export class ConfiguratorsController {
  constructor(
    private readonly configuratorsService: ConfiguratorsService,
    private readonly savedConfigurationsService: SavedConfigurationsService,
  ) {}

  /**
   * list every published configurator, curated for a browse page — no
   * pagination, ordered by name. Declared before :slug for readability
   * (no real path ambiguity: this route has no extra segment).
   */
  @Auth(AuthType.None)
  @ApiOperation({
    summary: 'List published configurators',
  })
  @ApiArrayDataResponse(ConfiguratorListItemDto)
  @Get()
  public findAll() {
    return this.configuratorsService.getPublishedList()
  }

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

  /**
   * save a frozen snapshot of a resolved configuration for the calling user —
   * the server re-resolves the selections itself and never trusts a
   * client-composed code; an invalid resolve is rejected with 400. Bearer
   * auth (any role) — the only authenticated route on this controller.
   */
  @ApiOperation({
    summary: 'Save a snapshot of a resolved configuration (authenticated)',
  })
  @ApiAuth()
  @ApiDataResponse(SavedConfiguration, {
    status: 201,
    description: 'Snapshot saved',
  })
  @ApiResponse({
    status: 400,
    description: 'Malformed selections object, or the resolve is invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Configurator not found or not published',
  })
  @Post(':slug/save')
  public save(
    @Param('slug') slug: string,
    @Body() dto: ResolveConfigurationDto,
    @ActiveUser('sub') userId: number,
  ) {
    return this.savedConfigurationsService.save(slug, dto, userId)
  }
}
