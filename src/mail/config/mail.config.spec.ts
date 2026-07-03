import mailConfig from './mail.config'

describe('mailConfig', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('uses CONTACT_NOTIFICATION_EMAIL when set', () => {
    process.env.MAIL_FROM = 'No Reply <noreply@example.com>'
    process.env.CONTACT_NOTIFICATION_EMAIL = 'owner@example.com'

    expect(mailConfig().contactNotificationEmail).toBe('owner@example.com')
  })

  it('falls back to MAIL_FROM when CONTACT_NOTIFICATION_EMAIL is unset', () => {
    process.env.MAIL_FROM = 'No Reply <noreply@example.com>'
    delete process.env.CONTACT_NOTIFICATION_EMAIL

    expect(mailConfig().contactNotificationEmail).toBe(
      'No Reply <noreply@example.com>',
    )
  })
})
