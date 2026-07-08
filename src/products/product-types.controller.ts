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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { ProductTypesService } from './providers/product-types.service'
import { ProductType } from './entities/product-type.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { CreateProductTypeDto } from './dto/create-product-type.dto'
import { UpdateProductTypeDto } from './dto/update-product-type.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiArrayDataResponse,
  ApiDataResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

@ApiTags('Product Types')
@Controller('product-types')
export class ProductTypesController {
  constructor(private readonly productTypesService: ProductTypesService) {}

  /**
   * list all product types — public; used by the frontend type picker and filter UI
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'List all product types' })
  @ApiArrayDataResponse(ProductType)
  @Get()
  public findAll() {
    return this.productTypesService.findAll()
  }

  /**
   * get a single product type by slug — public
   * Declared before /:id so NestJS does not try to parse "slug" as an integer.
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a product type by slug' })
  @ApiDataResponse(ProductType)
  @ApiResponse({ status: 404, description: 'Product type not found' })
  @Get('slug/:slug')
  public findBySlug(@Param('slug') slug: string) {
    return this.productTypesService.findBySlug(slug)
  }

  /**
   * get a single product type by id — public
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a product type by id' })
  @ApiDataResponse(ProductType)
  @ApiResponse({ status: 404, description: 'Product type not found' })
  @Get(':id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productTypesService.findOne(id)
  }

  /**
   * create a product type
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a product type (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ProductType, {
    status: 201,
    description: 'Product type created',
  })
  @ApiResponse({ status: 409, description: 'Name or slug already in use' })
  @Post()
  public create(
    @Body() dto: CreateProductTypeDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productTypesService.create(dto, adminId)
  }

  /**
   * update a product type's fields
   * Fields are add/remove only: a field's key and type are immutable, and a field or
   * enum option can only be removed when no product still uses it. Always send the
   * complete filterableFields list — the array is replaced wholesale.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Update a product type (admin only). Fields are add/remove only; key and type are immutable; send the complete field list.',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ProductType)
  @ApiResponse({
    status: 400,
    description:
      "Illegal field change (a field's key or type cannot be changed)",
  })
  @ApiResponse({
    status: 409,
    description:
      'Name or slug already in use, or a field/option removal is blocked because products still use it',
  })
  @Patch(':id')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductTypeDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productTypesService.update(id, dto, adminId)
  }

  /**
   * upload and set a product type's image (admin only) — unlike products/posts,
   * this is a single combined call: it uploads the file and sets imageUrl in one
   * request, replacing any previously tracked image
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Upload and set a product type's image (admin only). Replaces any previous image.",
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiDataResponse(ProductType, {
    description: 'Product type updated with the new imageUrl',
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
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
    @Param('id', ParseIntPipe) productTypeId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productTypesService.uploadImage(file, productTypeId, adminId)
  }

  /**
   * get the tracked image for a product type (admin only) — used by the admin
   * edit form to show upload metadata (size, mime, etc.)
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get the tracked image for a product type (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(UploadFile, { description: 'The UploadFile record' })
  @ApiResponse({ status: 404, description: 'Product type or image not found' })
  @Get(':id/image')
  public findImage(@Param('id', ParseIntPipe) productTypeId: number) {
    return this.productTypesService.findImage(productTypeId)
  }

  /**
   * clear a product type's image (admin only) — removes it from Cloudinary + DB
   * and clears imageUrl if it was still pointing at the deleted file
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Clear a product type's image (admin only)" })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(ProductType)
  @ApiResponse({ status: 404, description: 'Product type or image not found' })
  @Delete(':id/image')
  public deleteImage(
    @Param('id', ParseIntPipe) productTypeId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productTypesService.deleteImage(productTypeId, adminId)
  }

  /**
   * hard-delete a product type — rejected if any products still reference it
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a product type (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({
    status: 409,
    description: 'Products still reference this type',
  })
  @Delete(':id')
  public delete(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productTypesService.delete(id, adminId)
  }
}
