import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'

// Full production setup extracted from bootstrap() so main.ts stays slim.
// Configures the validation pipe, Swagger docs, CORS, then starts listening.
export async function appCreate(app: INestApplication): Promise<void> {
  const configService = app.get(ConfigService)
  const port = configService.get<number>('appConfig.appPort') ?? 3000

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.use(cookieParser())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS API - BlogApp')
    .setDescription('Use the base API URL as http://localhost:3000')
    .setTermsOfService('http://localhost:3000/terms-of-service')
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000')
    .setVersion('1.0')
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api', app, document)

  const frontendUrl =
    configService.get<string>('appConfig.frontendUrl') ??
    'http://localhost:5173'

  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  await app.listen(port)
}
