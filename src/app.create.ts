import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

// Full production setup extracted from bootstrap() so main.ts stays slim.
// Applies helmet security headers, cookie parser, validation pipe, Swagger, CORS, then listens.
export async function appCreate(app: INestApplication): Promise<void> {
  const configService = app.get(ConfigService)
  const port = configService.get<number>('appConfig.appPort') ?? 3000
  const appUrl =
    configService.get<string>('appConfig.appUrl') ?? 'http://localhost:3000'

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // helmet must run before cookie-parser so security headers are set on every response.
  app.use(helmet())
  app.use(cookieParser())

  if (configService.get<string>('appConfig.environments') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS API - BlogApp')
      .setDescription(`Base API URL: ${appUrl}`)
      .setTermsOfService(`${appUrl}/terms-of-service`)
      .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
      .addServer(appUrl)
      .setVersion('1.0')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api', app, document)
  }

  const frontendUrl =
    configService.get<string>('appConfig.frontendUrl') ??
    'http://localhost:5173'

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  await app.listen(port)
}
