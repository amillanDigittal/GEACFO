import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as compression from 'compression'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.use(helmet())
  app.use(compression())
  app.enableCors({
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    credentials: true,
  })
  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.useGlobalInterceptors(new AuditInterceptor())

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('GEACFO API')
    .setDescription('Plataforma CFO — API REST')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const doc = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, doc)

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`🚀 GEACFO API running on http://localhost:${port}`)
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`)
}
bootstrap()
