import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get()
  list(@Request() req: any) {
    return this.svc.list(req.user.tenantId)
  }

  @Get(':id')
  get(@Request() req: any, @Param('id') id: string) {
    return this.svc.get(req.user.tenantId, id)
  }

  @Post()
  create(@Request() req: any, @Body() body: { email: string; name: string; role: string; password: string }) {
    return this.svc.create(req.user.tenantId, body)
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: { email?: string; name?: string; role?: string; password?: string }) {
    return this.svc.update(req.user.tenantId, id, body)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.tenantId, id, req.user.userId)
  }
}
