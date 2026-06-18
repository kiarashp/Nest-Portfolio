import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'

// Every response from this API is wrapped by DataResponseInterceptor.
// Export this once so spec files don't each define it locally.
export interface ApiResponse<T> {
  apiVersion: string
  data: T
}

// Signs in via the real endpoint and returns the access token.
// Never forge JWTs manually — always use this to get a real token.
export async function getAuthToken(
  app: INestApplication<App>,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/sign-in')
    .send({ email, password })
  return (res.body as ApiResponse<{ accessToken: string }>).data.accessToken
}
