import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as compression from 'compression'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor'
import { StructuredLogger } from './common/logger/structured.logger'

async function bootstrap() {
  const logger = new StructuredLogger()
  const app = await NestFactory.create(AppModule, { logger })

  app.use(helmet())
  app.use(compression())
  app.enableCors({
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    credentials: true,
  })
  app.setGlobalPrefix('api/v1', { exclude: ['health'] })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.useGlobalInterceptors(new RequestLoggerInterceptor(), new AuditInterceptor())

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
  logger.log(`GEACFO API running on http://localhost:${port}`, 'Bootstrap')
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap')
  logger.log(`Health check: http://localhost:${port}/health`, 'Bootstrap')
}
bootstrap()
