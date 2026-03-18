import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BoardService } from './board.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Board')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('board')
export class BoardController {
  constructor(private svc: BoardService) {}
  @Get('pack') generate(@Request() req: any) { return this.svc.generate(req.user.tenantId) }
}
