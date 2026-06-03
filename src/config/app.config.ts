import { registerAs } from '@nestjs/config'

export default registerAs('appConfig', () => ({
  environments: process.env.NODE_ENV || 'production',
}))
