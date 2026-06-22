import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { User } from '../../src/users/entities/user.entity'
import { AVATAR_OPTIONS } from '../../src/users/constants/avatar-options'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('Avatar selection (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let token: string

  const EMAIL = 'avatar-select@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    await cleanupUsers(dataSource, [EMAIL])
    await seedUser(dataSource, { email: EMAIL, password: PASSWORD })
    token = await getAuthToken(app, EMAIL, PASSWORD)
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [EMAIL])
    await app.close()
  })

  // ── GET /users/avatar-options ─────────────────────────────────────────────

  it('GET /users/avatar-options (unauthenticated) → 200, array with key/label/url', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/avatar-options')
      .expect(200)

    const options = (res.body as ApiResponse<typeof AVATAR_OPTIONS>).data
    expect(Array.isArray(options)).toBe(true)
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      expect(option).toHaveProperty('key')
      expect(option).toHaveProperty('label')
      expect(option).toHaveProperty('url')
      expect(typeof option.key).toBe('string')
      expect(option.key.length).toBeGreaterThan(0)
      expect(option.url.length).toBeGreaterThan(0)
    }
  })

  // ── PATCH /users/avatar ───────────────────────────────────────────────────

  it('PATCH /users/avatar with valid key → 200, avatarUrl updated', async () => {
    const chosen = AVATAR_OPTIONS[0]

    const res = await request(app.getHttpServer())
      .patch('/users/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarKey: chosen.key })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.avatarUrl).toBe(chosen.url)
  })

  it('GET /users/me after selection → avatarUrl matches chosen option', async () => {
    const chosen = AVATAR_OPTIONS[1]

    await request(app.getHttpServer())
      .patch('/users/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarKey: chosen.key })
      .expect(200)

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect((res.body as ApiResponse<User>).data.avatarUrl).toBe(chosen.url)
  })

  it('PATCH /users/avatar with unknown key → 400', async () => {
    await request(app.getHttpServer())
      .patch('/users/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarKey: 'not-a-real-avatar' })
      .expect(400)
  })

  it('PATCH /users/avatar (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .patch('/users/avatar')
      .send({ avatarKey: AVATAR_OPTIONS[0].key })
      .expect(401)
  })
})
