import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CustomersService } from './customers.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private svc: CustomersService) {}

  @Get()
  getAll(@Request() req: any) { return this.svc.getAll(req.user.tenantId) }

  @Get(':id')
  getById(@Param('id') id: string, @Request() req: any) { return this.svc.getById(req.user.tenantId, id) }

  @Post(':id/recalculate-score')
  recalculate(@Param('id') id: string, @Request() req: any) { return this.svc.recalculateScore(req.user.tenantId, id) }
}
