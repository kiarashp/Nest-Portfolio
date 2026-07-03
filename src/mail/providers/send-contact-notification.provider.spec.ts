import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { SendContactNotificationProvider } from './send-contact-notification.provider'
import { SendMailProvider } from './send-mail.provider'

describe('SendContactNotificationProvider', () => {
  let provider: SendContactNotificationProvider
  let sendMailProvider: { send: jest.Mock }
  let configService: { get: jest.Mock }

  beforeEach(async () => {
    sendMailProvider = { send: jest.fn().mockResolvedValue(undefined) }
    configService = { get: jest.fn().mockReturnValue('owner@example.com') }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendContactNotificationProvider,
        { provide: SendMailProvider, useValue: sendMailProvider },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    provider = module.get(SendContactNotificationProvider)
  })

  it('sends the notification to mail.contactNotificationEmail, not mail.defaultFrom', async () => {
    const submission = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Hiring inquiry',
      message: 'Hello',
    }

    await provider.send(submission)

    expect(configService.get).toHaveBeenCalledWith(
      'mail.contactNotificationEmail',
    )
    expect(sendMailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: '[Contact] Hiring inquiry',
        template: 'contact',
      }),
    )
  })
})
