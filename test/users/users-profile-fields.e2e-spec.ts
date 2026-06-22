import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { User } from '../../src/users/entities/user.entity'
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

describe('User profile fields (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let token: string

  const EMAIL = 'profile-fields@e2e.test'
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

  // ── PATCH /users/me — bio field ───────────────────────────────────────────

  it('PATCH /users/me with bio → 200, bio returned in response', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'I build things for the web.' })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.bio).toBe(
      'I build things for the web.',
    )
  })

  it('GET /users/me → 200, bio field present', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect((res.body as ApiResponse<User>).data).toHaveProperty('bio')
  })

  it('PATCH /users/me with bio over 500 chars → 400', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'x'.repeat(501) })
      .expect(400)
  })

  it('PATCH /users/me with bio: "" → 200, stored as null', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: '' })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.bio).toBeNull()
  })

  it('PATCH /users/me with bio of only whitespace → 200, stored as null', async () => {
    // first set a real bio so we can confirm it gets cleared
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Some bio text' })
      .expect(200)

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: '   ' })
      .expect(200)

    expect((res.body as ApiResponse<User>).data.bio).toBeNull()
  })

  it('PATCH /users/me without bio field → 200, bio unchanged', async () => {
    // set a bio first
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Persistent bio' })
      .expect(200)

    // patch only firstName — bio must not be touched
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated' })
      .expect(200)

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect((res.body as ApiResponse<User>).data.bio).toBe('Persistent bio')
  })

  it('PATCH /users/me (unauthenticated) → 401', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ bio: 'Hacker' })
      .expect(401)
  })
})
