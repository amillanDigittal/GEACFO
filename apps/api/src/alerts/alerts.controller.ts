import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AlertsService } from './alerts.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private svc: AlertsService) {}
  @Get('counts') getCounts(@Request() req: any) { return this.svc.getCounts(req.user.tenantId) }
  @Get('notifications') getNotifications(@Request() req: any) { return this.svc.getNotifications(req.user.tenantId) }
  @Get('predictive') getPredictive(@Request() req: any) { return this.svc.getPredictive(req.user.tenantId) }
  @Get('resolutions') getResolutions(@Request() req: any) { return this.svc.getResolutions(req.user.tenantId) }
  @Post('resolutions') updateResolution(@Body() body: { alertId: string; status: string; notes?: string }, @Request() req: any) {
    return this.svc.updateResolution(req.user.tenantId, req.user.email, body.alertId, body.status, body.notes)
  }
}
