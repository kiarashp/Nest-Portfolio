import { Module } from '@nestjs/common'
import { TagsController } from './tags.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Tag } from './entities/tag.entity'
import { TagsService } from './providers/tags.service'
import { UpdateTagProvider } from './providers/update-tag.provider'

@Module({
  controllers: [TagsController],
  imports: [TypeOrmModule.forFeature([Tag])],
  providers: [TagsService, UpdateTagProvider],
  exports: [TagsService],
})
export class TagsModule {}
