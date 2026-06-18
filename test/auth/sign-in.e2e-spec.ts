import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as bcrypt from 'bcrypt'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module'
import { User } from '../../src/users/entities/user.entity'

// Shape of every response produced by DataResponseInterceptor.
interface ApiResponse<T> {
  apiVersion: string
  data: T
}

// Tokens returned by a successful sign-in.
interface SignInResponse {
  accessToken: string
  refreshToken: string
}

describe('POST /auth/sign-in (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  // Shared credentials used to seed the verified test user.
  const TEST_EMAIL = 'signin-test@example.com'
  const TEST_PASSWORD = 'Password123!'

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()

    // main.ts registers the ValidationPipe on the real app, but that file is
    // not executed during tests. We must recreate it here so that @Body() DTO
    // validation (whitelist, forbidNonWhitelisted, transform) actually runs.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )

    await app.init()

    // Pull the live TypeORM DataSource so we can write rows directly.
    // This lets us seed a user without going through POST /users, which would
    // trigger the mail service (and fail without a real SMTP server).
    dataSource = app.get(DataSource)

    // Seed one verified user — the happy-path tests authenticate as this person.
    const userRepo = dataSource.getRepository(User)
    await userRepo.save({
      firstName: 'Test',
      email: TEST_EMAIL,
      // Pre-hash the password exactly as BcryptProvider would at runtime.
      password: await bcrypt.hash(TEST_PASSWORD, 10),
      // Mark email as verified so SignInProvider does not reject with 401.
      isEmailVerified: true,
    })
  })

  afterAll(async () => {
    // Delete every user this suite created so the DB stays clean between runs.
    const userRepo = dataSource.getRepository(User)
    await userRepo.delete({ email: TEST_EMAIL })
    await userRepo.delete({ email: 'unverified@example.com' })
    await app.close()
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it('returns 200 and issues accessToken + refreshToken for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200)

    // Cast to a known shape — supertest types body as `any`, but we want
    // TypeScript to enforce the DataResponseInterceptor contract here.
    const body = res.body as ApiResponse<SignInResponse>
    // body.data is typed as SignInResponse, so these checks are fully type-safe.
    expect(body.apiVersion).toBeDefined()
    expect(body.data.accessToken).toBeTruthy()
    expect(body.data.refreshToken).toBeTruthy()
  })

  // ── Sad paths ────────────────────────────────────────────────────────────

  it('returns 401 when the password is wrong', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: TEST_EMAIL, password: 'WrongPassword!' })
      .expect(401)
  })

  it('returns 401 when the user has not verified their email', async () => {
    // Seed a second user with isEmailVerified = false to exercise that branch.
    const userRepo = dataSource.getRepository(User)
    await userRepo.save({
      firstName: 'Unverified',
      email: 'unverified@example.com',
      password: await bcrypt.hash(TEST_PASSWORD, 10),
      isEmailVerified: false,
    })

    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: 'unverified@example.com', password: TEST_PASSWORD })
      .expect(401)

    // Cleanup is handled in afterAll, but we could also do it here if needed.
  })

  it('returns 400 when a required field is missing', async () => {
    // The ValidationPipe rejects the request before it even reaches SignInProvider.
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ password: TEST_PASSWORD }) // missing 'email'
      .expect(400)
  })
})
