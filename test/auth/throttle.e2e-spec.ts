import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { createApp } from '../helpers/create-app.helper'

describe('Throttler Guard (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    // skipThrottle: false — this spec tests real rate limiting; the storage
    // must not be mocked so hit counts accumulate normally.
    ;({ app } = await createApp({ skipThrottle: false }))
  })

  afterAll(async () => {
    await app.close()
  })

  // ── Rate-limit headers ────────────────────────────────────────────────────

  it('throttled route includes x-ratelimit headers', async () => {
    // Wrong credentials — triggers 401 from the controller; throttler headers
    // are set before the response regardless of outcome.
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: 'nobody@e2e.test', password: 'WrongPass1!' })
      .expect(401)

    expect(res.headers['x-ratelimit-limit']).toBeDefined()
    expect(res.headers['x-ratelimit-remaining']).toBeDefined()
  })

  // ── 429 after limit exceeded ──────────────────────────────────────────────

  it('POST /auth/forgot-password → 429 after 3 requests within the window', async () => {
    // forgot-password has @Throttle({ default: { limit: 3, ttl: 300_000 } }).
    // Requests 1–3 pass through (200); request 4 is rejected by the guard (429).
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'throttle-test@e2e.test' })
        .expect(200)
    }

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'throttle-test@e2e.test' })
      .expect(429)
  })

  it('POST /auth/refresh-tokens → 429 after 10 requests within the window', async () => {
    // refresh-tokens has @Throttle({ default: { limit: 10, ttl: 60_000 } }).
    // ThrottlerGuard fires before the controller, so invalid-token 401 responses
    // still count toward the limit. Requests 1–10 return 401; request 11 → 429.
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/auth/refresh-tokens')
        .send({ refreshToken: 'invalid.token.value' })
        .expect(401)
    }

    await request(app.getHttpServer())
      .post('/auth/refresh-tokens')
      .send({ refreshToken: 'invalid.token.value' })
      .expect(429)
  })
})
