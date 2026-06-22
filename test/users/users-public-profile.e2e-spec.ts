import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { UserRole } from '../../src/auth/enums/user-role.enum'
import { ApiResponse } from '../helpers/auth.helper'
import { createApp } from '../helpers/create-app.helper'
import { cleanupUsers, seedUser } from '../helpers/seed.helper'

interface PublicProfile {
  id: number
  firstName: string
  lastName: string | null
  avatarUrl?: string
  bio?: string | null
}

describe('Public author profile (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  let authorId: number
  let adminId: number
  let userId: number

  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    await cleanupUsers(dataSource, [
      'pub-author@e2e.test',
      'pub-admin@e2e.test',
      'pub-user@e2e.test',
    ])

    const author = await seedUser(dataSource, {
      email: 'pub-author@e2e.test',
      password: PASSWORD,
      firstName: 'AuthorFirst',
      role: UserRole.AUTHOR,
    })
    authorId = author.id

    const admin = await seedUser(dataSource, {
      email: 'pub-admin@e2e.test',
      password: PASSWORD,
      firstName: 'AdminFirst',
      role: UserRole.ADMIN,
    })
    adminId = admin.id

    const user = await seedUser(dataSource, {
      email: 'pub-user@e2e.test',
      password: PASSWORD,
      firstName: 'UserFirst',
      role: UserRole.USER,
    })
    userId = user.id
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [
      'pub-author@e2e.test',
      'pub-admin@e2e.test',
      'pub-user@e2e.test',
    ])
    await app.close()
  })

  // ── GET /users/:id/profile ────────────────────────────────────────────────

  it('AUTHOR profile (unauthenticated) → 200, safe fields present', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${authorId}/profile`)
      .expect(200)

    const profile = (res.body as ApiResponse<PublicProfile>).data
    expect(profile.id).toBe(authorId)
    expect(profile.firstName).toBe('AuthorFirst')
    expect(profile).toHaveProperty('lastName')
    expect(profile).toHaveProperty('avatarUrl')
    expect(profile).toHaveProperty('bio')
  })

  it('AUTHOR profile → does NOT expose email, role, isEmailVerified, or password', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${authorId}/profile`)
      .expect(200)

    const profile = res.body as ApiResponse<Record<string, unknown>>
    expect(profile.data).not.toHaveProperty('email')
    expect(profile.data).not.toHaveProperty('role')
    expect(profile.data).not.toHaveProperty('isEmailVerified')
    expect(profile.data).not.toHaveProperty('password')
  })

  it('ADMIN profile → 200 (admin is publicly findable; role not in response)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${adminId}/profile`)
      .expect(200)

    const profile = (res.body as ApiResponse<PublicProfile>).data
    expect(profile.id).toBe(adminId)
    // Confirm role is not leaked — visitor cannot tell this is an admin
    expect(res.body as ApiResponse<Record<string, unknown>>).not.toHaveProperty(
      'data.role',
    )
  })

  it('USER-role account → 404 (regular accounts not publicly discoverable)', async () => {
    await request(app.getHttpServer())
      .get(`/users/${userId}/profile`)
      .expect(404)
  })

  it('Non-existent ID → 404', async () => {
    await request(app.getHttpServer()).get('/users/99999/profile').expect(404)
  })
})
