import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { createApp } from './helpers/create-app.helper'

describe('App (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    ;({ app } = await createApp())
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

  it('GET /health returns 200 without auth', async () => {
    await request(app.getHttpServer()).get('/health').expect(200)
  })

  it('GET /health returns { status: "ok" } in the data envelope', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200)
    const body = res.body as {
      data: { status: string; info: Record<string, { status: string }> }
    }
    expect(body.data.status).toBe('ok')
  })

  it('GET /health reports the database as up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200)
    const body = res.body as {
      data: { status: string; info: Record<string, { status: string }> }
    }
    expect(body.data.info['database'].status).toBe('up')
  })
})
