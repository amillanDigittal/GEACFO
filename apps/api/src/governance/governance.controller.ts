import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { GovernanceService } from './governance.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('governance')
export class GovernanceController {
  constructor(private svc: GovernanceService) {}
  @Get('sources') getSources(@Request() req: any) { return this.svc.getSources(req.user.tenantId) }
  @Get('audit') getAudit(@Request() req: any) { return this.svc.getAuditLog(req.user.tenantId) }
}
