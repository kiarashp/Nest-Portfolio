import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Transporter } from 'nodemailer'
import * as ejs from 'ejs'
import { join } from 'path'
import { NODEMAILER_TRANSPORTER } from './nodemailer.provider'
import { MailOptions } from '../interfaces/mail-options.interface'

@Injectable()
export class SendMailProvider {
  private readonly logger = new Logger(SendMailProvider.name)

  constructor(
    @Inject(NODEMAILER_TRANSPORTER)
    private readonly transporter: Transporter,
    private readonly configService: ConfigService,
  ) {}

  async send(options: MailOptions): Promise<void> {
    const templatePath = join(
      __dirname,
      '..',
      'templates',
      `${options.template}.ejs`,
    )
    const html = await ejs.renderFile(templatePath, options.context ?? {})

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('mail.defaultFrom'),
        to: options.to,
        subject: options.subject,
        html,
      })
      this.logger.log(
        `Email sent — template=${options.template}, to=${String(options.to)}`,
      )
    } catch (error) {
      this.logger.error(
        `Email failed — template=${options.template}, to=${String(options.to)}`,
        (error as Error).stack,
      )
      throw error
    }
  }
}
