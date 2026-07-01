import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductsController } from './products.controller'
import { ProductTypesController } from './product-types.controller'
import { ProductsService } from './providers/products.service'
import { ProductTypesService } from './providers/product-types.service'
import { Product } from './entities/product.entity'
import { ProductType } from './entities/product-type.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { PaginationModule } from 'src/common/pagination/pagination.module'
import { UploadsModule } from 'src/uploads/uploads.module'
import { AuditLogModule } from 'src/audit-log/audit-log.module'
import { CreateProductProvider } from './providers/create-product.provider'
import { FindAllProductsProvider } from './providers/find-all-products.provider'
import { FindOneProductProvider } from './providers/find-one-product.provider'
import { UpdateProductProvider } from './providers/update-product.provider'
import { DeleteProductProvider } from './providers/delete-product.provider'
import { UploadProductImageProvider } from './providers/upload-product-image.provider'
import { FindProductImagesProvider } from './providers/find-product-images.provider'
import { DeleteProductImageProvider } from './providers/delete-product-image.provider'
import { CreateProductTypeProvider } from './providers/create-product-type.provider'
import { FindAllProductTypesProvider } from './providers/find-all-product-types.provider'
import { FindOneProductTypeProvider } from './providers/find-one-product-type.provider'
import { UpdateProductTypeProvider } from './providers/update-product-type.provider'
import { DeleteProductTypeProvider } from './providers/delete-product-type.provider'
import { ValidateTypeChangeProvider } from './providers/validate-type-change.provider'

@Module({
  controllers: [ProductsController, ProductTypesController],
  providers: [
    ProductsService,
    ProductTypesService,
    CreateProductProvider,
    FindAllProductsProvider,
    FindOneProductProvider,
    UpdateProductProvider,
    DeleteProductProvider,
    UploadProductImageProvider,
    FindProductImagesProvider,
    DeleteProductImageProvider,
    CreateProductTypeProvider,
    FindAllProductTypesProvider,
    FindOneProductTypeProvider,
    UpdateProductTypeProvider,
    DeleteProductTypeProvider,
    ValidateTypeChangeProvider,
  ],
  imports: [
    TypeOrmModule.forFeature([Product, ProductType, UploadFile]),
    PaginationModule,
    UploadsModule,
    AuditLogModule,
  ],
})
export class ProductsModule {}
