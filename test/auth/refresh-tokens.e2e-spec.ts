import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as bcrypt from 'bcrypt'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module'
import { User } from '../../src/users/entities/user.entity'

interface ApiResponse<T> {
  apiVersion: string
  data: T
}

interface TokensResponse {
  accessToken: string
  refreshToken: string
}

describe('POST /auth/refresh-tokens (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  // Captured in beforeAll by performing a real sign-in.
  let validRefreshToken: string

  const TEST_EMAIL = 'refresh-test@example.com'
  const TEST_PASSWORD = 'Password123!'

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.init()

    dataSource = app.get(DataSource)

    // Seed a verified user directly to bypass the mail service.
    const userRepo = dataSource.getRepository(User)
    await userRepo.save({
      firstName: 'Refresh',
      email: TEST_EMAIL,
      password: await bcrypt.hash(TEST_PASSWORD, 10),
      isEmailVerified: true,
    })

    // Sign in via HTTP to obtain a real refresh token issued by the app.
    // This is intentional: we want the token the actual JwtService produces,
    // not one we manufactured manually.
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    const body = res.body as ApiResponse<TokensResponse>
    validRefreshToken = body.data.refreshToken
  })

  afterAll(async () => {
    const userRepo = dataSource.getRepository(User)
    await userRepo.delete({ email: TEST_EMAIL })
    await app.close()
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it('returns 200 and issues a new token pair for a valid refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({ refreshToken: validRefreshToken })
      .expect(200)

    const body = res.body as ApiResponse<TokensResponse>
    // Both tokens must be present and non-empty strings.
    expect(body.data.accessToken).toBeTruthy()
    expect(body.data.refreshToken).toBeTruthy()
  })

  // ── Sad paths ────────────────────────────────────────────────────────────

  it('returns 401 for an invalid refresh token', async () => {
    // A token we made up — signature verification will fail.
    await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({ refreshToken: 'this.is.not.a.real.jwt' })
      .expect(401)
  })

  it('returns 400 when the refreshToken field is missing', async () => {
    // ValidationPipe rejects the request before it reaches the provider.
    await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({})
      .expect(400)
  })
})
