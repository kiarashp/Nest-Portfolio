import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { createApp } from './helpers/create-app.helper'

describe('App (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    ;({ app } = await createApp(moduleFixture))
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 on a protected route when no token is provided', async () => {
    // GET /users requires Bearer auth (the default for all routes).
    // If the global AuthenticationGuard were missing, this would return 200
    // instead — making every authenticated endpoint publicly accessible.
    await request(app.getHttpServer()).get('/users').expect(401)
  })

  it('returns 404 for an unknown route', async () => {
    // Confirms the app is up and that unregistered paths are not accidentally
    // handled by some catch-all.
    await request(app.getHttpServer()).get('/this-does-not-exist').expect(404)
  })
})
