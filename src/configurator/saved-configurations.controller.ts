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
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { SavedConfigurationsService } from './providers/saved-configurations.service'
import { SavedConfiguration } from './entities/saved-configuration.entity'
import { QuoteMessage } from './entities/quote-message.entity'
import { GetSavedConfigurationsDto } from './dtos/get-saved-configurations.dto'
import { GetSavedConfigurationsAdminDto } from './dtos/get-saved-configurations-admin.dto'
import { PatchSavedConfigurationStatusDto } from './dtos/patch-saved-configuration-status.dto'
import { RequestQuoteDto } from './dtos/request-quote.dto'
import { GetQuoteMessagesDto } from './dtos/get-quote-messages.dto'
import { CreateQuoteMessageDto } from './dtos/create-quote-message.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { isDevelopmentEnvironment } from 'src/common/throttle/is-development.util'

/**
 * A registered user's saved configuration snapshots (CONFIGURATOR.md §5.3,
 * §7 Step 6). The owner-scoped routes below (any authenticated role) let a
 * user see and manage only their own rows — a snapshot belonging to someone
 * else 404s exactly like a missing id. Saving happens on
 * ConfiguratorsController (POST /configurators/:slug/save), since the slug
 * belongs to that path family. The admin/* routes are the quote-request
 * inbox (ADMIN only, unscoped by owner) — declared before the bare :id
 * routes below so the literal "admin" segment isn't swallowed by :id. Each
 * quote request carries one ticket-style message thread, served by the
 * :id/messages routes on both sides.
 */
@ApiTags('Saved configurations')
@Controller('saved-configurations')
export class SavedConfigurationsController {
  constructor(
    private readonly savedConfigurationsService: SavedConfigurationsService,
  ) {}

  /**
   * list quote requests across all users — admin only, paginated, filterable
   * by quoteStatus, newest request first. Scoped to rows where a quote was
   * actually requested. Rows carry the transient unreadCount.
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
   * read any quote-request thread, newest first — admin only; marks the
   * thread read for the admin side
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Read a quote request's message thread (admin only)",
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(QuoteMessage)
  @ApiResponse({ status: 404, description: 'Saved configuration not found' })
  @Get('admin/:id/messages')
  public findMessagesAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: GetQuoteMessagesDto,
    @Req() request: Request,
  ) {
    return this.savedConfigurationsService.findMessagesAdmin(id, dto, request)
  }

  /**
   * post a reply into any quote-request thread — admin only; bumps PENDING
   * to ANSWERED and emails the thread owner
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Reply on a quote-request thread (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(QuoteMessage, { status: 201 })
  @ApiResponse({
    status: 400,
    description: 'No quote was requested for this saved configuration',
  })
  @ApiResponse({ status: 404, description: 'Saved configuration not found' })
  @Post('admin/:id/messages')
  public createMessageAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateQuoteMessageDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.savedConfigurationsService.createMessageAdmin(
      id,
      dto,
      activeUserId,
    )
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
   * set the quoteStatus on a quote request — admin only; 400 if no quote was
   * ever requested
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Set the status of a quote request (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SavedConfiguration)
  @ApiResponse({
    status: 400,
    description: 'No quote was requested for this saved configuration',
  })
  @ApiResponse({ status: 404, description: 'Saved configuration not found' })
  @Patch('admin/:id')
  public updateStatusAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchSavedConfigurationStatusDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return this.savedConfigurationsService.updateStatusAdmin(
      id,
      dto,
      activeUserId,
    )
  }

  /**
   * list the calling user's saved configurations — paginated, newest first;
   * rows carry the transient unreadCount
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
   * read the caller's own quote-request thread, newest first — marks the
   * thread read for the owner; an empty thread reads as an empty page
   */
  @ApiOperation({
    summary: "Read the caller's quote-request message thread",
  })
  @ApiAuth()
  @ApiPaginatedResponse(QuoteMessage)
  @ApiResponse({
    status: 404,
    description: 'Saved configuration not found (or not owned by the caller)',
  })
  @Get(':id/messages')
  public findMessages(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') userId: number,
    @Query() dto: GetQuoteMessagesDto,
    @Req() request: Request,
  ) {
    return this.savedConfigurationsService.findMessages(
      id,
      userId,
      dto,
      request,
    )
  }

  /**
   * post a message into the caller's own quote-request thread — reopens the
   * status to PENDING and emails the site owner; 400 when no quote was
   * requested. Throttled like the other user-facing write endpoints, with
   * the standard dev-only bypass.
   */
  @ApiOperation({
    summary: "Post a message on the caller's quote-request thread",
  })
  @ApiAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @SkipThrottle({ default: isDevelopmentEnvironment })
  @ApiDataResponse(QuoteMessage, { status: 201 })
  @ApiResponse({
    status: 400,
    description: 'No quote was requested for this saved configuration',
  })
  @ApiResponse({
    status: 404,
    description: 'Saved configuration not found (or not owned by the caller)',
  })
  @Post(':id/messages')
  public createMessage(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') userId: number,
    @Body() dto: CreateQuoteMessageDto,
  ) {
    return this.savedConfigurationsService.createMessage(id, userId, dto)
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
   * stamps quoteRequestedAt, sets quoteStatus to PENDING, and emails the
   * site owner; an optional message becomes the first thread message and
   * rides inside that email. 404 when the id is missing or owned by another
   * user, 409 if a quote was already requested.
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
    @Body() dto: RequestQuoteDto,
  ) {
    return this.savedConfigurationsService.requestQuote(id, userId, dto)
  }
}
