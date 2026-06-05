import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // 1. Retrieve the ConfigService from the app instance
  const configService = app.get(ConfigService)
  // 2. Use it to pull your strongly-typed config
  const port = configService.get<number>('appConfig.appPort') || 3000
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('NestJS API - BlogApp')
    .setDescription('Use the base API URL as http://localhost:3000')
    .setTermsOfService('http://localhost:3000/terms-of-service')
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000')
    .setVersion('1.0')
    .build()
  // Instantiate the SwaggerModule
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)
  // Enable CORS
  app.enableCors()
  // Run the app
  await app.listen(port)
}
void bootstrap()
