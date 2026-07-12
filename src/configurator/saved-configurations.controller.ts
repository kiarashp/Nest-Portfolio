import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SavedConfigurationsService } from './providers/saved-configurations.service'
import { SavedConfiguration } from './entities/saved-configuration.entity'
import { GetSavedConfigurationsDto } from './dtos/get-saved-configurations.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

/**
 * A registered user's saved configuration snapshots (CONFIGURATOR.md §5.3,
 * §7 Step 6). Every route is owner-scoped: any authenticated role may call
 * them, but each user only ever sees their own rows — a snapshot belonging
 * to someone else 404s exactly like a missing id. Saving happens on
 * ConfiguratorsController (POST /configurators/:slug/save), since the slug
 * belongs to that path family.
 */
@ApiTags('Saved configurations')
@Controller('saved-configurations')
export class SavedConfigurationsController {
  constructor(
    private readonly savedConfigurationsService: SavedConfigurationsService,
  ) {}

  /**
   * list the calling user's saved configurations — paginated, newest first
   */
  @ApiOperation({ summary: "List the caller's saved configurations" })
  @ApiAuth()
  @ApiPaginatedResponse(SavedConfiguration)
  @Get()
  public findMy(
    @ActiveUser('sub') userId: number,
    @Query() dto: GetSavedConfigurationsDto,
    @Req() request: Request,
  ) {
    return this.savedConfigurationsService.findMy(userId, dto, request)
  }

  /**
   * get one of the calling user's saved configurations — 404 when the id is
   * missing or owned by another user
   */
  @ApiOperation({ summary: "Get one of the caller's saved configurations" })
  @ApiAuth()
  @ApiDataResponse(SavedConfiguration)
  @ApiResponse({
    status: 404,
    description: 'Saved configuration not found (or not owned by the caller)',
  })
  @Get(':id')
  public findOne(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') userId: number,
  ) {
    return this.savedConfigurationsService.findOne(id, userId)
  }

  /**
   * delete one of the calling user's saved configurations — hard delete,
   * 404 when the id is missing or owned by another user
   */
  @ApiOperation({ summary: "Delete one of the caller's saved configurations" })
  @ApiAuth()
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({
    status: 404,
    description: 'Saved configuration not found (or not owned by the caller)',
  })
  @Delete(':id')
  public delete(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') userId: number,
  ) {
    return this.savedConfigurationsService.delete(id, userId)
  }

  /**
   * request a quote for one of the calling user's saved configurations —
   * stamps quoteRequestedAt and emails the site owner; 404 when the id is
   * missing or owned by another user, 409 if a quote was already requested
   */
  @ApiOperation({
    summary: "Request a quote for one of the caller's saved configurations",
  })
  @ApiAuth()
  @HttpCode(HttpStatus.OK)
  @ApiDataResponse(SavedConfiguration)
  @ApiResponse({
    status: 404,
    description: 'Saved configuration not found (or not owned by the caller)',
  })
  @ApiResponse({ status: 409, description: 'Quote already requested' })
  @Post(':id/request-quote')
  public requestQuote(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') userId: number,
  ) {
    return this.savedConfigurationsService.requestQuote(id, userId)
  }
}
