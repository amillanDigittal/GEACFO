import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SuppliersService } from './suppliers.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private svc: SuppliersService) {}

  @Get()
  getAll(@Request() req: any) { return this.svc.getAll(req.user.tenantId) }

  @Get(':id')
  getById(@Param('id') id: string, @Request() req: any) { return this.svc.getById(req.user.tenantId, id) }

  @Post()
  create(@Request() req: any, @Body() body: { code: string; name: string; nif?: string; email?: string; phone?: string; category?: string; paymentTerms?: number; notes?: string }) {
    return this.svc.create(req.user.tenantId, body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.svc.update(req.user.tenantId, id, body)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) { return this.svc.remove(req.user.tenantId, id) }

  @Post(':id/recalculate')
  recalculate(@Param('id') id: string, @Request() req: any) { return this.svc.recalculateScore(req.user.tenantId, id) }

  @Post('recalculate-all')
  recalculateAll(@Request() req: any) { return this.svc.recalculateAll(req.user.tenantId) }
}
