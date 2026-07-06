import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Post } from 'src/posts/entities/post.entity'
import { Product } from 'src/products/entities/product.entity'
import { ProductType } from 'src/products/entities/product-type.entity'
import { User } from 'src/users/entities/user.entity'
import { ContactSubmission } from 'src/contact/entities/contact-submission.entity'
import { AdminController } from './admin.controller'
import { AdminStatsService } from './providers/admin-stats.service'
import { AdminStatsProvider } from './providers/admin-stats.provider'

@Module({
  // Registers foreign entities directly for read-only cross-entity aggregation,
  // mirroring AuditLogModule's pattern for the foreign User entity — avoids
  // importing PostsModule/ProductsModule/UsersModule/ContactModule just to
  // reach their repositories.
  imports: [
    TypeOrmModule.forFeature([
      Post,
      Product,
      ProductType,
      User,
      ContactSubmission,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminStatsService, AdminStatsProvider],
})
export class AdminModule {}
