import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { appCreate } from './app.create'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // Enables NestJS to listen for SIGTERM/SIGINT so in-flight requests can
  // finish before the process exits during a Coolify redeploy or container stop.
  app.enableShutdownHooks()
  await appCreate(app)
}
void bootstrap()
