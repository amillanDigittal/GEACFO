import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SettingsService } from './settings.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private svc: SettingsService) {}

  @Get('tenant')
  getTenant(@Request() req: any) {
    return this.svc.getTenant(req.user.tenantId)
  }

  @Patch('tenant')
  updateTenant(@Request() req: any, @Body() body: any) {
    return this.svc.updateTenant(req.user.tenantId, body)
  }

  @Get('config')
  getSettings(@Request() req: any) {
    return this.svc.getSettings(req.user.tenantId)
  }

  @Patch('config')
  updateSettings(@Request() req: any, @Body() body: any) {
    return this.svc.updateSettings(req.user.tenantId, body)
  }
}
