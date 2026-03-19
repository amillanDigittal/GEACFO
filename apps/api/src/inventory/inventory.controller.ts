import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { InventoryService } from './inventory.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private svc: InventoryService) {}
  @Get() getAll(@Request() req: any) { return this.svc.getAll(req.user.tenantId) }
  @Get('abc') getAbc(@Request() req: any) { return this.svc.getAbcAnalysis(req.user.tenantId) }
}
