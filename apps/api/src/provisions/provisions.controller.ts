import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ProvisionsService } from './provisions.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Provisions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('provisions')
export class ProvisionsController {
  constructor(private svc: ProvisionsService) {}

  @Get('matrix')
  getMatrix(@Request() req: any) { return this.svc.calculateMatrix(req.user.tenantId) }

  @Post('snapshot')
  createSnapshot(@Request() req: any) { return this.svc.createSnapshot(req.user.tenantId, req.user.userId) }

  @Get('snapshots')
  getSnapshots(@Request() req: any) { return this.svc.getSnapshots(req.user.tenantId) }

  @Get('snapshots/:id')
  getSnapshot(@Param('id') id: string, @Request() req: any) { return this.svc.getSnapshot(req.user.tenantId, id) }
}
