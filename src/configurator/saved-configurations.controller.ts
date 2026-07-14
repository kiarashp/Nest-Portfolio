import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SavedConfigurationsService } from './providers/saved-configurations.service'
import { SavedConfiguration } from './entities/saved-configuration.entity'
import { GetSavedConfigurationsDto } from './dtos/get-saved-configurations.dto'
import { GetSavedConfigurationsAdminDto } from './dtos/get-saved-configurations-admin.dto'
import { PatchSavedConfigurationReviewedDto } from './dtos/patch-saved-configuration-reviewed.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'

/**
 * A registered user's saved configuration snapshots (CONFIGURATOR.md §5.3,
 * §7 Step 6). The owner-scoped routes below (any authenticated role) let a
 * user see and manage only their own rows — a snapshot belonging to someone
 * else 404s exactly like a missing id. Saving happens on
 * ConfiguratorsController (POST /configurators/:slug/save), since the slug
 * belongs to that path family. The admin/* routes are the quote-request
 * inbox (ADMIN only, unscoped by owner) — declared before the bare :id
 * routes below so the literal "admin" segment isn't swallowed by :id.
 */
@ApiTags('Saved configurations')
@Controller('saved-configurations')
export class SavedConfigurationsController {
  constructor(
    private readonly savedConfigurationsService: SavedConfigurationsService,
  ) {}

  /**
   * list quote requests across all users — admin only, paginated, filterable
   * by quoteReviewed, newest request first. Scoped to rows where a quote was
   * actually requested.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List quote requests (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(SavedConfiguration)
  @Get('admin')
  public findAllAdmin(
    @Query() dto: GetSavedConfigurationsAdminDto,
    @Req() request: Request,
  ) {
    return this.savedConfigurationsService.findAllAdmin(dto, request)
  }

  /**
   * get one saved configuration by id, regardless of owner — admin only
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a quote request by ID (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SavedConfiguration)
  @ApiResponse({ status: 404, description: 'Saved configuration not found' })
  @Get('admin/:id')
  public findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.savedConfigurationsService.findOneAdmin(id)
  }

  /**
   * toggle the quoteReviewed flag on a quote request — admin only
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Toggle the reviewed flag on a quote request (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SavedConfiguration)
  @ApiResponse({ status: 404, description: 'Saved configuration not found' })
  @Patch('admin/:id')
  public reviewAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchSavedConfigurationReviewedDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.savedConfigurationsService.reviewAdmin(id, dto, activeUserId)
  }

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
