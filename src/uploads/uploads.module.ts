import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import type { ConfigType } from '@nestjs/config'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './providers/uploads.service'
import { StorageProvider } from './providers/storage.provider'
import { CloudinaryProvider } from './providers/cloudinary.provider'
import { LocalDiskStorageProvider } from './providers/local-disk.provider'
import { UploadFileProvider } from './providers/upload-file.provider'
import { DeleteFileProvider } from './providers/delete-file.provider'
import { UploadFile } from './entities/upload-file.entity'
import cloudinaryConfig from 'src/config/cloudinary.config'
import uploadsConfig from 'src/config/uploads.config'

@Module({
  controllers: [UploadsController],
  imports: [
    TypeOrmModule.forFeature([UploadFile]),
    ConfigModule.forFeature(cloudinaryConfig),
    ConfigModule.forFeature(uploadsConfig),
  ],
  providers: [
    UploadsService,
    UploadFileProvider,
    DeleteFileProvider,
    // Driver is chosen by STORAGE_DRIVER (default 'local', see uploads.config.ts).
    // Only the selected backend's class is ever instantiated, so the other
    // backend's env vars don't need to be set — see environment.validation.ts.
    {
      provide: StorageProvider,
      inject: [uploadsConfig.KEY, cloudinaryConfig.KEY, ConfigService],
      useFactory: (
        uploadsConfiguration: ConfigType<typeof uploadsConfig>,
        cloudinaryConfiguration: ConfigType<typeof cloudinaryConfig>,
        configService: ConfigService,
      ): StorageProvider =>
        uploadsConfiguration.driver === 'cloudinary'
          ? new CloudinaryProvider(cloudinaryConfiguration)
          : new LocalDiskStorageProvider(uploadsConfiguration, configService),
    },
  ],
  // StorageProvider is exported so other modules (e.g. UsersModule for avatar options)
  // can upload/delete directly without going through UploadsService or creating UploadFile rows.
  exports: [UploadsService, StorageProvider],
})
export class UploadsModule {}
