import * as nodemailer from 'nodemailer'
import { ConfigService } from '@nestjs/config'

export const NODEMAILER_TRANSPORTER = 'NODEMAILER_TRANSPORTER'

export const NodemailerProvider = {
  provide: NODEMAILER_TRANSPORTER,
  inject: [ConfigService],
  useFactory: (cs: ConfigService) =>
    nodemailer.createTransport({
      host: cs.get<string>('mail.host'),
      port: cs.get<number>('mail.port'),
      secure: cs.get<string>('mail.secure') === 'true',
      auth: {
        user: cs.get<string>('mail.user'),
        pass: cs.get<string>('mail.password'),
      },
    }),
}
