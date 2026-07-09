import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ConfiguratorDefinitionsService } from './providers/configurator-definitions.service'
import { SegmentDefinition } from './entities/segment-definition.entity'
import { SegmentOption } from './entities/segment-option.entity'
import { CreateSegmentDefinitionDto } from './dtos/create-segment-definition.dto'
import { UpdateSegmentDefinitionDto } from './dtos/update-segment-definition.dto'
import { GetSegmentDefinitionsDto } from './dtos/get-segment-definitions.dto'
import { CreateSegmentOptionDto } from './dtos/create-segment-option.dto'
import { UpdateSegmentOptionDto } from './dtos/update-segment-option.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

/**
 * Admin CRUD for the reusable segment-definition library and its options
 * (CONFIGURATOR.md §5.1, §7 Step 2). No base prefix — routes mix
 * /configurator-definitions/* and /configurator-options/* under one controller,
 * so each handler carries its own literal path.
 */
@ApiTags('Configurator - Segment Definitions')
@Controller()
export class ConfiguratorDefinitionsController {
  constructor(
    private readonly configuratorDefinitionsService: ConfiguratorDefinitionsService,
  ) {}

  /**
   * list segment definitions — admin only, paginated
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List segment definitions (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(SegmentDefinition)
  @Get('configurator-definitions')
  public findAll(
    @Query() dto: GetSegmentDefinitionsDto,
    @Req() request: Request,
  ) {
    return this.configuratorDefinitionsService.findAll(dto, request)
  }

  /**
   * get a single segment definition by id, including its options — admin only
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a segment definition by id, including options (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SegmentDefinition)
  @ApiResponse({ status: 404, description: 'Segment definition not found' })
  @Get('configurator-definitions/:id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.configuratorDefinitionsService.findOne(id)
  }

  /**
   * create a segment definition
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a segment definition (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SegmentDefinition, {
    status: 201,
    description: 'Segment definition created',
  })
  @ApiResponse({ status: 400, description: 'Invalid constraints for dataType' })
  @ApiResponse({ status: 409, description: 'Name already in use' })
  @Post('configurator-definitions')
  public create(
    @Body() dto: CreateSegmentDefinitionDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorDefinitionsService.create(dto, adminId)
  }

  /**
   * update a segment definition's fields — dataType is rejected once any
   * product assignment uses this definition
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a segment definition (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SegmentDefinition)
  @ApiResponse({ status: 400, description: 'Invalid constraints for dataType' })
  @ApiResponse({
    status: 409,
    description:
      'Name already in use, or dataType change blocked because it is already assigned',
  })
  @Patch('configurator-definitions/:id')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSegmentDefinitionDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorDefinitionsService.update(id, dto, adminId)
  }

  /**
   * hard-delete a segment definition — rejected if any product assignment
   * still references it
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a segment definition (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({
    status: 409,
    description: 'Still assigned to one or more products',
  })
  @Delete('configurator-definitions/:id')
  public delete(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorDefinitionsService.delete(id, adminId)
  }

  /**
   * add an option to a SELECT segment definition
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Add an option to a SELECT segment definition (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SegmentOption, {
    status: 201,
    description: 'Segment option created',
  })
  @ApiResponse({
    status: 400,
    description: 'Definition is not SELECT, or value is the reserved "0"',
  })
  @ApiResponse({
    status: 409,
    description: 'Value already in use on this definition',
  })
  @Post('configurator-definitions/:id/options')
  public createOption(
    @Param('id', ParseIntPipe) definitionId: number,
    @Body() dto: CreateSegmentOptionDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorDefinitionsService.createOption(
      definitionId,
      dto,
      adminId,
    )
  }

  /**
   * update a segment option's fields
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update a segment option's fields (admin only)" })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(SegmentOption)
  @ApiResponse({ status: 400, description: 'Value is the reserved "0"' })
  @ApiResponse({
    status: 409,
    description: 'Value already in use on this definition',
  })
  @Patch('configurator-options/:optionId')
  public updateOption(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdateSegmentOptionDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorDefinitionsService.updateOption(
      optionId,
      dto,
      adminId,
    )
  }

  /**
   * delete a segment option — rejected if it would leave an assigned SELECT
   * definition with fewer than 2 options
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a segment option (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({
    status: 409,
    description:
      'Would leave an assigned SELECT definition with fewer than 2 options',
  })
  @Delete('configurator-options/:optionId')
  public deleteOption(
    @Param('optionId', ParseIntPipe) optionId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorDefinitionsService.deleteOption(optionId, adminId)
  }
}
