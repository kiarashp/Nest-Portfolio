import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ProductTypesService } from './providers/product-types.service'
import { CreateProductTypeDto } from './dto/create-product-type.dto'
import { UpdateProductTypeDto } from './dto/update-product-type.dto'
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
  @Get()
  public findAll() {
    return this.productTypesService.findAll()
  }

  /**
   * get a single product type by id — public
   */
  @Auth(AuthType.None)
  @ApiOperation({ summary: 'Get a product type by id' })
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
  @ApiResponse({ status: 201, description: 'Product type created' })
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
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a product type (admin only)' })
  @ApiResponse({ status: 409, description: 'Name or slug already in use' })
  @Patch(':id')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductTypeDto,
    @ActiveUser('sub') adminId: number,
  ) {
    return this.productTypesService.update(id, dto, adminId)
  }

  /**
   * hard-delete a product type — rejected if any products still reference it
   */
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a product type (admin only)' })
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
