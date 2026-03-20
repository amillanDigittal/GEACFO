import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BudgetService } from './budget.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Budget')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(private svc: BudgetService) {}

  @Get()
  getBudget(@Request() req: any, @Query('year') year?: string) {
    return this.svc.getBudget(req.user.tenantId, year ? parseInt(year) : new Date().getFullYear())
  }

  @Post('lines')
  upsertLines(@Request() req: any, @Body() body: { year: number; lines: { month: number; category: string; amount: number }[] }) {
    return this.svc.upsertLines(req.user.tenantId, body.year, body.lines)
  }

  @Post('init')
  initDefaults(@Request() req: any, @Body() body: { year: number }) {
    return this.svc.initDefaults(req.user.tenantId, body.year)
  }

  @Get('variance')
  getVariance(@Request() req: any, @Query('year') year?: string) {
    return this.svc.getVarianceData(req.user.tenantId, year ? parseInt(year) : new Date().getFullYear())
  }
}
