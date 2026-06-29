import { INestApplication, ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import helmet from 'helmet'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module'
import { MailService } from '../../src/mail/mail.service'
import { StorageProvider } from '../../src/uploads/providers/storage.provider'

// Per-method mail overrides. Unspecified methods receive a jest.fn() no-op.
interface MailMock {
  sendMail?: jest.Mock
  sendWelcomeMail?: jest.Mock
  sendVerificationMail?: jest.Mock
  sendPasswordResetMail?: jest.Mock
  sendContactNotification?: jest.Mock
}

// Per-method storage overrides. Unspecified methods get a sensible default mock.
interface StorageMock {
  upload?: jest.Mock
  delete?: jest.Mock
}

interface CreateAppOptions {
  // Pass individual mocks only for methods whose calls you need to assert on.
  mailMock?: MailMock
  // Override specific StorageProvider methods to capture calls or change return values.
  storageMock?: StorageMock
  // Mocks ThrottlerStorage so rate limits never fire. Default: true.
  // Set to false only in throttle.e2e-spec.ts where real throttling is tested.
  skipThrottle?: boolean
}

// Builds, compiles, and initialises the NestJS app for e2e tests.
//
// Applies two defaults that every non-throttle spec needs:
//  1. MailService is always mocked — prevents real SMTP connections.
//  2. ThrottlerStorage is mocked (unless skipThrottle: false) — prevents
//     429s when a spec hits the same route more times than the rate limit.
//
// ThrottlerGuard still runs; it just always sees "first hit, not blocked"
// because overrideProvider(ThrottlerStorage) replaces the token that the
// guard injects — overrideGuard / overrideProvider(ThrottlerGuard) both
// fail silently because the guard lives under APP_GUARD, not ThrottlerGuard.
export async function createApp(
  options: CreateAppOptions = {},
): Promise<{ app: INestApplication<App>; dataSource: DataSource }> {
  const { mailMock = {}, storageMock = {}, skipThrottle = true } = options

  const noop = (): jest.Mock => jest.fn().mockResolvedValue(undefined)

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({
      sendMail: mailMock.sendMail ?? noop(),
      sendWelcomeMail: mailMock.sendWelcomeMail ?? noop(),
      sendVerificationMail: mailMock.sendVerificationMail ?? noop(),
      sendPasswordResetMail: mailMock.sendPasswordResetMail ?? noop(),
      sendContactNotification: mailMock.sendContactNotification ?? noop(),
    })
    // Always mock StorageProvider — prevents any spec from hitting Cloudinary.
    // Default upload returns a stable mock URL and publicId.
    .overrideProvider(StorageProvider)
    .useValue({
      upload:
        storageMock.upload ??
        jest.fn().mockResolvedValue({
          url: 'https://res.cloudinary.com/mock/image/upload/v1/avatars/test.jpg',
          publicId: 'avatars/test',
        }),
      delete: storageMock.delete ?? noop(),
    })

  if (skipThrottle) {
    builder = builder.overrideProvider(ThrottlerStorage).useValue({
      increment: jest.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
  }

  const moduleFixture = await builder.compile()
  const app = moduleFixture.createNestApplication<INestApplication<App>>()

  // Mirror the 'extended' query parser from src/app.create.ts so bracket-nested
  // params (e.g. ?specs[tempRange][min]=100) parse into nested objects in tests.
  ;(app as NestExpressApplication).set('query parser', 'extended')

  // Mirror helmet from src/app.create.ts so security header assertions work in tests.
  app.use(helmet())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  await app.init()
  const dataSource = app.get(DataSource)
  return { app, dataSource }
}
