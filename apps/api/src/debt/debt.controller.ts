import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { DebtService } from './debt.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Debt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('debt')
export class DebtController {
  constructor(private svc: DebtService) {}
  @Get('summary') getSummary(@Request() req: any) { return this.svc.getSummary(req.user.tenantId) }
  @Get('instruments') getInstruments(@Request() req: any) { return this.svc.getInstruments(req.user.tenantId) }
  @Get('covenants') getCovenants(@Request() req: any) { return this.svc.getCovenants(req.user.tenantId) }
  @Get('amortization') getAmortization(@Request() req: any) { return this.svc.getAmortizationSchedule(req.user.tenantId) }
}
