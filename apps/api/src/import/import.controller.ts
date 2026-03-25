import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { ImportService } from './import.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

// Strict limit on imports: 10 per minute per user (bulk DB operations)
@Throttle({ default: { ttl: 60_000, limit: 10 }, short: { ttl: 10_000, limit: 3 } })
@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private svc: ImportService) {}

  @Get('templates')
  getTemplates() { return this.svc.getTemplates() }

  @Post('movements')
  importMovements(@Request() req: any, @Body() body: { accountAlias: string; rows: any[] }) {
    return this.svc.importBankMovements(req.user.tenantId, body)
  }

  @Post('invoices-ar')
  importInvoicesAR(@Request() req: any, @Body() body: { rows: any[] }) {
    return this.svc.importInvoicesAR(req.user.tenantId, body.rows)
  }

  @Post('invoices-ap')
  importInvoicesAP(@Request() req: any, @Body() body: { rows: any[] }) {
    return this.svc.importInvoicesAP(req.user.tenantId, body.rows)
  }

  @Post('inventory')
  importInventory(@Request() req: any, @Body() body: { rows: any[] }) {
    return this.svc.importInventory(req.user.tenantId, body.rows)
  }
}
