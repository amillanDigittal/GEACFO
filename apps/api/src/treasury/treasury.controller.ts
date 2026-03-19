import { Controller, Get, Patch, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TreasuryService } from './treasury.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Treasury')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private svc: TreasuryService) {}

  @Get('cockpit')
  getCockpit(@Request() req: any) {
    return this.svc.getCockpitKPIs(req.user.tenantId)
  }

  @Get('cashflow')
  getCashFlow(@Request() req: any) {
    return this.svc.getCashFlowStatement(req.user.tenantId)
  }

  @Get('ratios')
  getRatios(@Request() req: any) {
    return this.svc.getFinancialRatios(req.user.tenantId)
  }

  @Get('auto-match')
  getAutoMatch(@Request() req: any) {
    return this.svc.getAutoMatches(req.user.tenantId)
  }

  @Get('forecast')
  getForecast(@Request() req: any, @Query('scenario') scenario?: string) {
    return this.svc.getForecast(req.user.tenantId, scenario)
  }

  @Get('forecast/compare')
  getForecastComparison(@Request() req: any) {
    return this.svc.getForecastComparison(req.user.tenantId)
  }

  @Get('accounts')
  getAccounts(@Request() req: any) {
    return this.svc.getBankAccounts(req.user.tenantId)
  }

  @Get('reconciliation')
  getReconciliation(@Request() req: any) {
    return this.svc.getReconciliation(req.user.tenantId)
  }

  @Get('ar')
  getAR(@Request() req: any) {
    return this.svc.getInvoicesAR(req.user.tenantId)
  }

  @Get('ap')
  getAP(@Request() req: any) {
    return this.svc.getInvoicesAP(req.user.tenantId)
  }

  @Patch('ap/:id/approve')
  approveAP(@Param('id') id: string, @Request() req: any) {
    return this.svc.approveInvoiceAP(id, req.user.userId)
  }

  @Post('ap/approve-batch')
  approveAPBatch(@Body() body: { ids: string[] }, @Request() req: any) {
    return this.svc.approveInvoicesAPBatch(body.ids, req.user.userId)
  }

  @Patch('movements/:id/reconcile')
  reconcileMovement(@Param('id') id: string, @Request() req: any) {
    return this.svc.reconcileMovement(id, req.user.tenantId)
  }

  @Post('movements/reconcile-batch')
  reconcileBatch(@Body() body: { ids: string[] }, @Request() req: any) {
    return this.svc.reconcileMovements(body.ids, req.user.tenantId)
  }
}
