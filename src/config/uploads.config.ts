import { registerAs } from '@nestjs/config'

export default registerAs('uploadsConfig', () => ({
  driver: process.env.STORAGE_DRIVER || 'local',
  dir: process.env.UPLOADS_DIR || './uploads',
}))
