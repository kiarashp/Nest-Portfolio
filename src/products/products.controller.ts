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
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { ProductsService } from './providers/products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { GetProductsDto } from './dto/get-products.dto'
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
  @ApiResponse({ status: 201, description: 'Product created' })
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
  @ApiResponse({
    status: 404,
    description: 'Product not found or not published',
  })
  @Get('slug/:slug')
  public findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug)
  }

  /**
   * list all products regardless of isPublished (admin only)
   * Declared before /:id so NestJS does not try to parse "admin" as an integer.
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all products including drafts (admin only)' })
  @Get('admin')
  public findAllAdmin(@Query() dto: GetProductsDto, @Req() request: Request) {
    return this.productsService.findAllAdmin(dto, request)
  }

  /**
   * get a single published product by id — public
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a published product by id' })
  @ApiResponse({
    status: 404,
    description: 'Product not found or not published',
  })
  @Get(':id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id)
  }

  /**
   * update a product (admin only) — use isPublished to publish or unpublish
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a product (admin only)' })
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
   * upload the main product image — sets imageUrl on the product record
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload main product image (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Image uploaded; product returned with updated imageUrl',
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
    @Param('id', ParseIntPipe) productId: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productsService.uploadImage(file, productId, adminId)
  }

  /**
   * soft-delete a product — row stays in DB but is excluded from all public queries
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a product (admin only)' })
  @Delete(':id')
  public remove(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productsService.softDelete(id, adminId)
  }
}
