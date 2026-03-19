import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ReportingService } from './reporting.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reporting')
export class ReportingController {
  constructor(private svc: ReportingService) {}

  @Get('schedules')
  list(@Request() req: any) { return this.svc.list(req.user.tenantId) }

  @Post('schedules')
  create(@Request() req: any, @Body() body: { name: string; reportType: string; frequency: string; recipients: string }) {
    return this.svc.create(req.user.tenantId, req.user.email, body)
  }

  @Patch('schedules/:id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(req.user.tenantId, id, body)
  }

  @Delete('schedules/:id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.tenantId, id)
  }

  @Post('schedules/:id/send')
  markSent(@Request() req: any, @Param('id') id: string) {
    return this.svc.markSent(req.user.tenantId, id)
  }
}
