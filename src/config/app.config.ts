import { registerAs } from '@nestjs/config'

export default registerAs('appConfig', () => ({
  environments: process.env.NODE_ENV || 'production',
  appPort: parseInt(process.env.APP_PORT || '3000', 10),
}))
