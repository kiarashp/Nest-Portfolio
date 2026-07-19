import { INestApplication, Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import type { Response } from 'express'
import { resolveUploadsDir } from './uploads/utils/resolve-uploads-dir.util'

// Full production setup extracted from bootstrap() so main.ts stays slim.
// Applies helmet security headers, cookie parser, validation pipe, Swagger, CORS, then listens.
export async function appCreate(app: INestApplication): Promise<void> {
  const logger = new Logger('Bootstrap')
  const configService = app.get(ConfigService)
  const port = configService.get<number>('appConfig.appPort') ?? 3000
  const appUrl =
    configService.get<string>('appConfig.appUrl') ?? 'http://localhost:3000'

  // Express 5 defaults to the 'simple' query parser, which does not nest bracket
  // params. Switch to 'extended' (qs) so product spec filters like
  // ?specs[tempRange][min]=100 parse into a nested object. qs still parses the
  // posts tagIds array params, so this is backward-compatible.
  ;(app as NestExpressApplication).set('query parser', 'extended')

  // Coolify/Railway terminate TLS at a reverse proxy in front of this app.
  // Without trusting that one hop, Express reads req.ip as the proxy's own
  // address (so ThrottlerGuard's per-IP limit becomes one shared bucket for
  // all visitors) and request.protocol as 'http' (so PaginationProvider
  // builds https-site pagination links with an http:// scheme).
  ;(app as NestExpressApplication).set('trust proxy', 1)

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

  if (configService.get<string>('uploadsConfig.driver') !== 'cloudinary') {
    const uploadsDir = resolveUploadsDir(
      configService.get<string>('uploadsConfig.dir') ?? './uploads',
    )
    // Must be registered after app.use(helmet()) above: static middleware ends
    // the response for a matched file, so anything registered later —
    // including helmet — would never run for /uploads/* requests. Registering
    // here lets helmet's defaults apply first, then this setHeaders callback
    // overwrites Cross-Origin-Resource-Policy for this route only — helmet's
    // global default (same-origin) would otherwise block the frontend, a
    // different origin in production, from loading <img> tags pointed at
    // these URLs in Chrome-family browsers.
    ;(app as NestExpressApplication).useStaticAssets(uploadsDir, {
      prefix: '/uploads',
      maxAge: '365d',
      immutable: true, // filenames are randomly generated per upload — a "replace" always gets a new URL
      setHeaders: (res: Response) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      },
    })
    logger.log(`Serving local uploads from ${uploadsDir} at /uploads`)
  }

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
    logger.log('Swagger UI available at /api')
  } else {
    logger.log('Swagger UI disabled in production')
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
  logger.log(`CORS enabled for origin: ${frontendUrl}`)

  await app.listen(port)
  logger.log(`Listening on port ${port}`)
}
