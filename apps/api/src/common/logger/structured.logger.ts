import { LoggerService, LogLevel } from '@nestjs/common'

/**
 * Structured JSON logger for production monitoring.
 * Outputs one JSON object per line — compatible with CloudWatch, Datadog,
 * ELK, Loki, and any log aggregator that parses JSON.
 *
 * In development (NODE_ENV !== 'production'), falls back to readable console output.
 */
export class StructuredLogger implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production'

  log(message: any, context?: string) {
    this.emit('info', message, context)
  }

  error(message: any, trace?: string, context?: string) {
    this.emit('error', message, context, trace)
  }

  warn(message: any, context?: string) {
    this.emit('warn', message, context)
  }

  debug(message: any, context?: string) {
    this.emit('debug', message, context)
  }

  verbose(message: any, context?: string) {
    this.emit('verbose', message, context)
  }

  private emit(level: string, message: any, context?: string, trace?: string) {
    if (this.isProduction) {
      const entry: Record<string, any> = {
        timestamp: new Date().toISOString(),
        level,
        context: context || 'Application',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      }
      if (trace) entry.trace = trace
      process.stdout.write(JSON.stringify(entry) + '\n')
    } else {
      // Readable dev output
      const tag = context ? `[${context}]` : ''
      const prefix = `${level.toUpperCase().padEnd(5)} ${tag}`
      if (level === 'error') {
        console.error(prefix, message, trace || '')
      } else if (level === 'warn') {
        console.warn(prefix, message)
      } else {
        console.log(prefix, message)
      }
    }
  }
}
