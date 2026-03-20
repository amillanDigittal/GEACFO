import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ImportService } from './import.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

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
