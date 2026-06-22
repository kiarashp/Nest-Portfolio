import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './providers/uploads.service'
import { StorageProvider } from './providers/storage.provider'
import { CloudinaryProvider } from './providers/cloudinary.provider'
import { UploadFileProvider } from './providers/upload-file.provider'
import { DeleteFileProvider } from './providers/delete-file.provider'
import { UploadFile } from './entities/upload-file.entity'
import cloudinaryConfig from 'src/config/cloudinary.config'

@Module({
  controllers: [UploadsController],
  imports: [
    TypeOrmModule.forFeature([UploadFile]),
    ConfigModule.forFeature(cloudinaryConfig),
  ],
  providers: [
    UploadsService,
    UploadFileProvider,
    DeleteFileProvider,
    // To swap storage backends, change `useClass` here — nothing else needs to change.
    { provide: StorageProvider, useClass: CloudinaryProvider },
  ],
  // StorageProvider is exported so other modules (e.g. UsersModule for avatar options)
  // can upload/delete directly without going through UploadsService or creating UploadFile rows.
  exports: [UploadsService, StorageProvider],
})
export class UploadsModule {}
