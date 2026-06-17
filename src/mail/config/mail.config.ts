import { registerAs } from '@nestjs/config'

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_SECURE,
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASSWORD,
  defaultFrom: process.env.MAIL_FROM,
}))
