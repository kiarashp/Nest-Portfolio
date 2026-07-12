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
import { ProductsService } from './providers/products.service'
import { Product } from './entities/product.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { GetProductsDto } from './dto/get-products.dto'
import { GetProductBySlugDto } from './dto/get-product-by-slug.dto'
import { GetRelatedProductsDto } from './dto/get-related-products.dto'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiArrayDataResponse,
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * create a new product (admin only) — starts unpublished by default
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a product (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(Product, { status: 201, description: 'Product created' })
  @ApiResponse({ status: 409, description: 'Slug or SKU already in use' })
  @Post()
  public create(
    @Body() dto: CreateProductDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productsService.create(dto, adminId)
  }

  /**
   * list published products — public; supports ?productTypeId and ?q filters
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'List published products' })
  @ApiPaginatedResponse(Product)
  @Get()
  public findAll(@Query() dto: GetProductsDto, @Req() request: Request) {
    return this.productsService.findAll(dto, request)
  }

  /**
   * get a single published product by slug — public
   * Declared before /:id so NestJS does not try to parse "slug" as an integer.
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a published product by slug' })
  @ApiDataResponse(Product)
  @ApiResponse({
    status: 404,
    description: 'Product not found or not published',
  })
  @Get('slug/:slug')
  public findBySlug(
    @Param('slug') slug: string,
    @Query() dto: GetProductBySlugDto,
  ) {
    return this.productsService.findBySlug(slug, dto.includeRelated)
  }

  /**
   * get a single published product by SKU — public
   * Declared before /:id so NestJS does not try to parse "sku" as an integer.
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a published product by SKU' })
  @ApiDataResponse(Product)
  @ApiResponse({
    status: 404,
    description: 'Product not found or not published',
  })
  @Get('sku/:sku')
  public findBySku(
    @Param('sku') sku: string,
    @Query() dto: GetProductBySlugDto,
  ) {
    return this.productsService.findBySku(sku, dto.includeRelated)
  }

  /**
   * list all products regardless of isPublished (admin only)
   * Declared before /:id so NestJS does not try to parse "admin" as an integer.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all products including drafts (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiPaginatedResponse(Product)
  @Get('admin')
  public findAllAdmin(@Query() dto: GetProductsDto, @Req() request: Request) {
    return this.productsService.findAllAdmin(dto, request)
  }

  /**
   * get a single product by id regardless of publish status (admin only) — used
   * by the admin edit form, which must be able to load drafts
   * Declared before /:id so NestJS does not try to parse "admin" as an integer.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a product by id including drafts (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(Product)
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Get(':id/admin')
  public findOneForEdit(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOneForEdit(id)
  }

  /**
   * get a single published product by id — public
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a published product by id' })
  @ApiDataResponse(Product)
  @ApiResponse({
    status: 404,
    description: 'Product not found or not published',
  })
  @Get(':id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id)
  }

  /**
   * list up to `limit` other published products of the same type — public.
   * Used by the frontend product detail page's "related products" section.
   */
  @Auth(AuthType.None)
  @ApiOperation({
    summary: 'List related products (same type, published, excluding self)',
  })
  @ApiArrayDataResponse(Product, {
    description: 'Array of related products, newest first',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found or not published',
  })
  @Get(':id/related')
  public findRelated(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: GetRelatedProductsDto,
  ) {
    return this.productsService.findRelated(id, dto.limit)
  }

  /**
   * update a product (admin only) — use isPublished to publish or unpublish
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a product (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(Product)
  @ApiResponse({ status: 409, description: 'Slug or SKU already in use' })
  @Patch(':id')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productsService.update(id, dto, adminId)
  }

  /**
   * upload an image for a product (admin only) — stores an UploadFile row linked
   * to the product and returns it. The frontend then sets imageUrl (featured) or
   * adds the URL to images (gallery) via PATCH /products/:id.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload a product image (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiDataResponse(UploadFile, {
    status: 201,
    description: 'Image uploaded; UploadFile record returned',
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @Post(':id/images')
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
    return this.productsService.uploadImage(file, productId, adminId)
  }

  /**
   * list all images uploaded for a product (admin only) — used by the frontend
   * image picker to choose the featured image and build the gallery
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all images uploaded for a product (admin only)',
  })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiArrayDataResponse(UploadFile, {
    description: 'Array of UploadFile records',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Get(':id/images')
  public findImages(@Param('id', ParseIntPipe) productId: number) {
    return this.productsService.findImages(productId)
  }

  /**
   * get a single uploaded image for a product (admin only)
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a single product image (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(UploadFile, { description: 'The UploadFile record' })
  @ApiResponse({ status: 404, description: 'Product or image not found' })
  @Get(':id/images/:fileId')
  public findImage(
    @Param('id', ParseIntPipe) productId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    return this.productsService.findImage(productId, fileId)
  }

  /**
   * delete a single uploaded image from a product (admin only) — removes it from
   * Cloudinary + DB and clears it from imageUrl/images if referenced
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a product image (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({ status: 404, description: 'Product or image not found' })
  @Delete(':id/images/:fileId')
  public removeImage(
    @Param('id', ParseIntPipe) productId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productsService.deleteImage(productId, fileId, adminId)
  }

  /**
   * soft-delete a product — row stays in DB but is excluded from all public queries
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a product (admin only)' })
  @ApiAuth({ roles: [UserRole.ADMIN] })
  @ApiDataResponse(DeleteResultDto)
  @Delete(':id')
  public remove(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productsService.softDelete(id, adminId)
  }
}
