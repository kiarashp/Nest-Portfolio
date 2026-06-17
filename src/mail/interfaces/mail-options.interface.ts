export interface MailOptions {
  to: string | string[]
  subject: string
  template: string
  context?: Record<string, unknown>
}
