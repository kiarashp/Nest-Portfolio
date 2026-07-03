import { registerAs } from '@nestjs/config'

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_SECURE,
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASSWORD,
  defaultFrom: process.env.MAIL_FROM,
  // recipient for contact form notifications — falls back to MAIL_FROM if unset, so a
  // no-reply MAIL_FROM sender doesn't force notifications into the same no-reply inbox
  contactNotificationEmail:
    process.env.CONTACT_NOTIFICATION_EMAIL || process.env.MAIL_FROM,
}))
