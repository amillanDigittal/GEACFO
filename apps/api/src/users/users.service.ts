import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

@Injectable()
export class UsersService {
  async list(tenantId: string) {
    const users = await prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, lastLogin: true, createdAt: true, updatedAt: true },
    })
    return users
  }

  async get(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, lastLogin: true, createdAt: true, updatedAt: true },
    })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    return user
  }

  async create(tenantId: string, data: { email: string; name: string; role: string; password: string }) {
    const existing = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: data.email } } })
    if (existing) throw new ConflictException('Ya existe un usuario con ese email')
    const hashed = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({
      data: { tenantId, email: data.email, name: data.name, role: data.role as any, password: hashed },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, lastLogin: true, createdAt: true, updatedAt: true },
    })
    return user
  }

  async update(tenantId: string, id: string, data: { email?: string; name?: string; role?: string; password?: string }) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: data.email } } })
      if (existing) throw new ConflictException('Ya existe un usuario con ese email')
    }

    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.role) updateData.role = data.role
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10)

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, lastLogin: true, createdAt: true, updatedAt: true },
    })
  }

  async remove(tenantId: string, id: string, requesterId: string) {
    if (id === requesterId) throw new ConflictException('No puedes eliminarte a ti mismo')
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    await prisma.user.delete({ where: { id } })
    return { deleted: true }
  }
}
