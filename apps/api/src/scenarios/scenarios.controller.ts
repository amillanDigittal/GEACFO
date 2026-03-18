import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ScenariosService } from './scenarios.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Scenarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scenarios')
export class ScenariosController {
  constructor(private svc: ScenariosService) {}
  @Get('compare') compare(@Request() req: any) { return this.svc.compare(req.user.tenantId) }
  @Post('simulate') simulate(@Request() req: any, @Body() body: { dso?: number; revenueChange?: number }) { return this.svc.simulate(req.user.tenantId, body) }
  @Get('variance') getVariance(@Request() req: any) { return this.svc.getVariance(req.user.tenantId) }
}
