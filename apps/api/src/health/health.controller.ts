import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const startedAt = new Date()

@SkipThrottle()
@Controller()
export class HealthController {
  /**
   * GET /health — liveness + readiness check.
   * Returns 200 if the API process is alive and DB is reachable,
   * 503 otherwise. Designed for Docker HEALTHCHECK, load balancers, and uptime monitors.
   */
  @Get('health')
  async check() {
    const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }> = {}

    // ── Database ──────────────────────────────────────────────
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = { status: 'up', latencyMs: Date.now() - dbStart }
    } catch (err: any) {
      checks.database = { status: 'down', latencyMs: Date.now() - dbStart, error: err.message }
    }

    // ── Memory ───────────────────────────────────────────────
    const mem = process.memoryUsage()
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024)
    const rssMB = Math.round(mem.rss / 1024 / 1024)

    // ── Overall status ───────────────────────────────────────
    const allUp = Object.values(checks).every(c => c.status === 'up')

    const body = {
      status: allUp ? 'healthy' : 'degraded',
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      startedAt: startedAt.toISOString(),
      checks,
      memory: { heapUsedMB, heapTotalMB, rssMB },
      node: process.version,
    }

    if (!allUp) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE)
    }

    return body
  }
}
