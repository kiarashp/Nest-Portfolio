import { INestApplication, ValidationPipe } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'

// Minimal bootstrap helper shared by all e2e suites.
//
// Usage:
//   1. Build your module: const fixture = await Test.createTestingModule({...})
//        .overrideProvider(...)   // add provider overrides before compile if needed
//        .compile()
//   2. const { app, dataSource } = await createApp(fixture)
//
// This is intentionally separate from src/app.create.ts — production uses
// NestFactory + app.listen() + Swagger + CORS; tests use TestingModule +
// app.init() and need none of those extras.
export async function createApp(
  moduleFixture: TestingModule,
): Promise<{ app: INestApplication<App>; dataSource: DataSource }> {
  const app = moduleFixture.createNestApplication<INestApplication<App>>()

  // Mirror the ValidationPipe from src/app.create.ts so DTO validation
  // behaves exactly as it does in production.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  await app.init()
  const dataSource = app.get(DataSource)
  return { app, dataSource }
}
