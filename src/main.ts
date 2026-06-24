import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { appCreate } from './app.create'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  // Enables NestJS to listen for SIGTERM/SIGINT so in-flight requests can
  // finish before the process exits during a Coolify redeploy or container stop.
  app.enableShutdownHooks()
  await appCreate(app)
  Logger.log('Bootstrap complete', 'Bootstrap')
}
void bootstrap()
