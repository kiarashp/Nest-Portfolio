import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as bcrypt from 'bcrypt'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
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

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  // Tokens obtained by signing in as each role.
  let userToken: string
  let adminToken: string
  // ID of the regular user — used to verify ADMIN can fetch any profile by ID.
  let userId: number

  const PASSWORD = 'Password123!'

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
    const userRepo = dataSource.getRepository(User)
    const hash = await bcrypt.hash(PASSWORD, 10)

    // Seed a regular USER. TypeORM returns the saved row with the generated id.
    const savedUser = await userRepo.save({
      firstName: 'Regular',
      email: 'rbac-user@example.com',
      password: hash,
      isEmailVerified: true,
      role: UserRole.USER,
    })
    userId = savedUser.id

    // Seed an ADMIN directly — elevating via the API would require an existing
    // admin, so we bypass that chicken-and-egg problem with a direct DB insert.
    await userRepo.save({
      firstName: 'Admin',
      email: 'rbac-admin@example.com',
      password: hash,
      isEmailVerified: true,
      role: UserRole.ADMIN,
    })

    // Sign in as both roles to obtain real access tokens.
    const signIn = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email, password: PASSWORD })
      return (res.body as ApiResponse<TokensResponse>).data.accessToken
    }

    userToken = await signIn('rbac-user@example.com')
    adminToken = await signIn('rbac-admin@example.com')
  })

  afterAll(async () => {
    const userRepo = dataSource.getRepository(User)
    await userRepo.delete({ email: 'rbac-user@example.com' })
    await userRepo.delete({ email: 'rbac-admin@example.com' })
    await app.close()
  })

  // ── Unauthenticated ──────────────────────────────────────────────────────

  it('returns 401 when no token is provided on a protected route', async () => {
    await request(app.getHttpServer()).get('/users').expect(401)
  })

  // ── Role enforcement ─────────────────────────────────────────────────────

  it('returns 403 when a USER hits an ADMIN-only route', async () => {
    // GET /users is decorated with @Roles(UserRole.ADMIN).
    // A valid token is present, so AuthenticationGuard passes, but
    // RolesGuard rejects because the role on the token is USER.
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('returns 200 when an ADMIN hits an ADMIN-only route', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
  })

  // ── Self-profile ─────────────────────────────────────────────────────────

  it('returns 200 for GET /users/me', async () => {
    // Any authenticated user can fetch their own profile via /me.
    // Also proves the access token is accepted by AccessTokenGuard.
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
  })

  it('returns 403 when a USER hits GET /users/:id (admin-only)', async () => {
    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
  })

  it('returns 200 when an ADMIN hits GET /users/:id', async () => {
    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
  })
})
