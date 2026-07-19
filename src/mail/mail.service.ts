import { Injectable } from '@nestjs/common'
import { SendMailProvider } from './providers/send-mail.provider'
import { SendWelcomeMailProvider } from './providers/send-welcome-mail.provider'
import { SendVerificationMailProvider } from './providers/send-verification-mail.provider'
import { SendPasswordResetMailProvider } from './providers/send-password-reset-mail.provider'
import { SendContactNotificationProvider } from './providers/send-contact-notification.provider'
import { SendQuoteRequestMailProvider } from './providers/send-quote-request-mail.provider'
import { SendQuoteMessageNotificationProvider } from './providers/send-quote-message-notification.provider'
import { SendQuoteReplyMailProvider } from './providers/send-quote-reply-mail.provider'
import { MailOptions } from './interfaces/mail-options.interface'

@Injectable()
export class MailService {
  constructor(
    private readonly sendMailProvider: SendMailProvider,
    private readonly sendWelcomeMailProvider: SendWelcomeMailProvider,
    private readonly sendVerificationMailProvider: SendVerificationMailProvider,
    private readonly sendPasswordResetMailProvider: SendPasswordResetMailProvider,
    // dedicated provider for contact form notifications
    private readonly sendContactNotificationProvider: SendContactNotificationProvider,
    // dedicated provider for configurator quote-request notifications
    private readonly sendQuoteRequestMailProvider: SendQuoteRequestMailProvider,
    // dedicated provider for user-posted quote-thread messages (to site owner)
    private readonly sendQuoteMessageNotificationProvider: SendQuoteMessageNotificationProvider,
    // dedicated provider for admin quote-thread replies (to the user)
    private readonly sendQuoteReplyMailProvider: SendQuoteReplyMailProvider,
  ) {}

  async sendMail(options: MailOptions): Promise<void> {
    return this.sendMailProvider.send(options)
  }

  async sendWelcomeMail(user: {
    email: string
    firstName: string
  }): Promise<void> {
    return this.sendWelcomeMailProvider.sendWelcome(user)
  }

  async sendVerificationMail(user: {
    email: string
    firstName: string
    verificationUrl: string
  }): Promise<void> {
    return this.sendVerificationMailProvider.sendVerification(user)
  }

  async sendPasswordResetMail(user: {
    email: string
    firstName: string
    resetUrl: string
  }): Promise<void> {
    return this.sendPasswordResetMailProvider.sendPasswordReset(user)
  }

  /** Sends a contact form notification to the site owner. */
  async sendContactNotification(submission: {
    name: string
    email: string
    subject: string
    message: string
  }): Promise<void> {
    return this.sendContactNotificationProvider.send(submission)
  }

  /** Sends a configurator quote-request notification to the site owner. */
  async sendQuoteRequestMail(request: {
    savedConfigurationId: number
    userEmail: string
    userFirstName: string
    productName: string
    code: string
    summary: string[]
    message: string | null
  }): Promise<void> {
    return this.sendQuoteRequestMailProvider.send(request)
  }

  /** Notifies the site owner of a new user message on a quote-request thread. */
  async sendQuoteMessageNotification(payload: {
    userEmail: string
    userFirstName: string
    productName: string
    code: string
    messageBody: string
  }): Promise<void> {
    return this.sendQuoteMessageNotificationProvider.send(payload)
  }

  /** Notifies the thread owner of an admin reply on their quote-request thread. */
  async sendQuoteReplyMail(payload: {
    userEmail: string
    userFirstName: string
    productName: string
    code: string
    messageBody: string
  }): Promise<void> {
    return this.sendQuoteReplyMailProvider.send(payload)
  }
}
