import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { Observable, tap } from 'rxjs'

/**
 * Logs every HTTP request with method, path, status, duration, and user context.
 * In production (with StructuredLogger), this produces JSON lines ideal for log aggregation.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const { method, originalUrl } = req
    const start = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse()
          const duration = Date.now() - start
          const userId = req.user?.userId || '-'
          const tenantId = req.user?.tenantId || '-'
          this.logger.log(
            `${method} ${originalUrl} ${res.statusCode} ${duration}ms user=${userId} tenant=${tenantId}`,
          )
        },
        error: (err) => {
          const duration = Date.now() - start
          const status = err.status || err.getStatus?.() || 500
          const userId = req.user?.userId || '-'
          const tenantId = req.user?.tenantId || '-'
          this.logger.warn(
            `${method} ${originalUrl} ${status} ${duration}ms user=${userId} tenant=${tenantId} error="${err.message}"`,
          )
        },
      }),
    )
  }
}
