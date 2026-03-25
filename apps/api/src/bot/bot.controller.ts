import { Controller, Post, Get, Body, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { BotService } from './bot.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Bot CFO')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bot')
export class BotController {
  constructor(private svc: BotService) {}

  // Strict limit: 15 chat messages per minute per user (Anthropic API cost control)
  @Throttle({ default: { ttl: 60_000, limit: 15 }, short: { ttl: 10_000, limit: 5 } })
  @Post('chat')
  chat(
    @Request() req: any,
    @Body() body: { message: string; sessionId: string; context?: string }
  ) {
    return this.svc.chat(req.user.tenantId, req.user.userId, body.sessionId, body.message, body.context)
  }

  @Get('history')
  history(@Request() req: any, @Query('sessionId') sessionId: string) {
    return this.svc.getHistory(req.user.tenantId, sessionId)
  }

  @Get('recommendations')
  recommendations(@Request() req: any) {
    return this.svc.getRecommendations(req.user.tenantId)
  }

  @Get('sessions')
  sessions(@Request() req: any) {
    return this.svc.getSessions(req.user.tenantId)
  }
}
