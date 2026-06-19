import { registerAs } from '@nestjs/config'

export default registerAs('appConfig', () => ({
  environments: process.env.NODE_ENV || 'production',
  appPort: parseInt(process.env.APP_PORT || '3000', 10),
  apiVersion: process.env.API_VERSION,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
}))
