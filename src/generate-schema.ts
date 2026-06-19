import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import { AppModule } from 'src/app.module'

async function generateSchema(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false })

  const config = new DocumentBuilder()
    .setTitle('NestJS API - BlogApp')
    .setDescription('Use the base API URL as http://localhost:3000')
    .setTermsOfService('http://localhost:3000/terms-of-service')
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000')
    .setVersion('1.0')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  writeFileSync('./openapi.json', JSON.stringify(document, null, 2))

  await app.close()
  console.log('✅  openapi.json written')
}

generateSchema().catch(console.error)
