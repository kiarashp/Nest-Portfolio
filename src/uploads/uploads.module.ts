import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './providers/uploads.service'
import { CloudinaryProvider } from './providers/cloudinary.provider'
import { UploadFile } from './entities/upload-file.entity'
import cloudinaryConfig from 'src/config/cloudinary.config'

@Module({
  controllers: [UploadsController],
  imports: [
    TypeOrmModule.forFeature([UploadFile]),
    ConfigModule.forFeature(cloudinaryConfig),
  ],
  providers: [UploadsService, CloudinaryProvider],
  exports: [UploadsService],
})
export class UploadsModule {}
