import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { LocalAuthGuard } from './local.guard'
import { JwtAuthGuard } from './jwt.guard'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // Strict limit: 10 login attempts per minute per IP (brute-force protection)
  @Throttle({ default: { ttl: 60_000, limit: 10 }, short: { ttl: 10_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: any) {
    return this.auth.login(req.user)
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  refresh(@Request() req: any) {
    return this.auth.refresh(req.user.userId, req.user.tenantId, req.user.email, req.user.role)
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return this.auth.getProfile(req.user.userId)
  }
}
