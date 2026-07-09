import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import type { Request } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { ConfiguratorProductsService } from './providers/configurator-products.service'
import { ConfigurableProduct } from './entities/configurable-product.entity'
import { ProductSegmentAssignment } from './entities/product-segment-assignment.entity'
import { CreateConfigurableProductDto } from './dtos/create-configurable-product.dto'
import { UpdateConfigurableProductDto } from './dtos/update-configurable-product.dto'
import { GetConfiguratorProductsDto } from './dtos/get-configurator-products.dto'
import { CreateAssignmentDto } from './dtos/create-assignment.dto'
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
 * Admin CRUD for ConfigurableProduct and its single-slot image
 * (CONFIGURATOR.md §5.1, §7 Step 3). A single path family, so unlike
 * ConfiguratorDefinitionsController this controller uses a base prefix.
 */
@ApiTags('Configurator - Products')
@Controller('configurator-products')
export class ConfiguratorProductsController {
  constructor(
    private readonly configuratorProductsService: ConfiguratorProductsService,
  ) {}

  /**
   * list configurable products — admin only, paginated, includes unpublished
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List configurable products (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(ConfigurableProduct)
  @Get()
  public findAll(
    @Query() dto: GetConfiguratorProductsDto,
    @Req() request: Request,
  ) {
    return this.configuratorProductsService.findAll(dto, request)
  }

  /**
   * get a single configurable product by id — admin only, includes
   * unpublished, includes ordered assignments with their definitions and
   * options
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Get a configurable product by id, including ordered assignments (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ConfigurableProduct)
  @ApiResponse({ status: 404, description: 'Configurable product not found' })
  @Get(':id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.configuratorProductsService.findOne(id)
  }

  /**
   * create a configurable product
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a configurable product (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ConfigurableProduct, {
    status: 201,
    description: 'Configurable product created',
  })
  @ApiResponse({ status: 409, description: 'Name or slug already in use' })
  @Post()
  public create(
    @Body() dto: CreateConfigurableProductDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorProductsService.create(dto, adminId)
  }

  /**
   * update a configurable product's fields — name, slug, codePrefix,
   * description, isPublished. imageUrl/imagePublicId are not patchable here,
   * only via the dedicated image endpoints below.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a configurable product (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ConfigurableProduct)
  @ApiResponse({ status: 404, description: 'Configurable product not found' })
  @ApiResponse({ status: 409, description: 'Name or slug already in use' })
  @Patch(':id')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConfigurableProductDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorProductsService.update(id, dto, adminId)
  }

  /**
   * soft-delete a configurable product — the Cloudinary image is kept, not
   * purged (CONFIGURATOR.md §2.1/§7)
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a configurable product (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({ status: 404, description: 'Configurable product not found' })
  @Delete(':id')
  public delete(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorProductsService.delete(id, adminId)
  }

  /**
   * upload and set a configurable product's image (admin only) — a single
   * combined call, replacing any previously tracked image
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Upload and set a configurable product's image (admin only). Replaces any previous image.",
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiDataResponse(ConfigurableProduct, {
    status: 201,
    description: 'Configurable product updated with the new imageUrl',
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 404, description: 'Configurable product not found' })
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  public uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Param('id', ParseIntPipe) productId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorProductsService.uploadImage(
      file,
      productId,
      adminId,
    )
  }

  /**
   * clear a configurable product's image (admin only) — removes it from
   * Cloudinary and clears imageUrl/imagePublicId
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Clear a configurable product's image (admin only)",
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ConfigurableProduct)
  @ApiResponse({
    status: 404,
    description: 'Configurable product or image not found',
  })
  @Delete(':id/image')
  public deleteImage(
    @Param('id', ParseIntPipe) productId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorProductsService.deleteImage(productId, adminId)
  }

  /**
   * add an assignment placing a segment definition at a position inside a
   * configurable product — defaults to appending when no position is given
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Add an assignment to a configurable product (admin only). Defaults to appending.',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ProductSegmentAssignment, {
    status: 201,
    description: 'Assignment created',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid position or condition, or definition not eligible (e.g. SELECT with < 2 options)',
  })
  @ApiResponse({
    status: 404,
    description: 'Configurable product or segment definition not found',
  })
  @ApiResponse({
    status: 409,
    description: 'This definition is already assigned to this product',
  })
  @Post(':id/assignments')
  public createAssignment(
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: CreateAssignmentDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.configuratorProductsService.createAssignment(
      productId,
      dto,
      adminId,
    )
  }
}
