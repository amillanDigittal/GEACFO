import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  async validateUser(email: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    })
    if (!user) throw new UnauthorizedException('Credenciales inválidas')
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedException('Credenciales inválidas')
    const { password: _, ...result } = user
    return result
  }

  async login(user: any) {
    const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role }
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenant: user.tenant },
    }
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    }) as any
    if (!user) throw new NotFoundException('Usuario no encontrado')
    delete user.password
    return user
  }
}
