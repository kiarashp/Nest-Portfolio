import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { createApp } from './helpers/create-app.helper'

describe('Security Headers (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    ;({ app } = await createApp())
  })

  afterAll(async () => {
    await app.close()
  })

  // ── Helmet headers ────────────────────────────────────────────────────────

  it('error response includes helmet security headers', async () => {
    // Wrong credentials — triggers a 401; helmet headers must still be present.
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: 'nobody@e2e.test', password: 'WrongPass1!' })
      .expect(401)

    expect(res.headers['x-frame-options']).toBeDefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-dns-prefetch-control']).toBeDefined()
    expect(res.headers['strict-transport-security']).toBeDefined()
  })

  it('success response includes helmet security headers', async () => {
    // Sign-out always returns 200; confirms headers appear on success too.
    const res = await request(app.getHttpServer())
      .post('/auth/sign-out')
      .expect(200)

    expect(res.headers['x-frame-options']).toBeDefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-dns-prefetch-control']).toBeDefined()
    expect(res.headers['strict-transport-security']).toBeDefined()
  })
})
