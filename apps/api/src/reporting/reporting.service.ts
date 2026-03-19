import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class ReportingService {
  async list(tenantId: string) {
    return prisma.reportSchedule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(tenantId: string, createdBy: string, data: { name: string; reportType: string; frequency: string; recipients: string }) {
    const nextRunAt = this.calcNextRun(data.frequency)
    return prisma.reportSchedule.create({
      data: { tenantId, createdBy, name: data.name, reportType: data.reportType, frequency: data.frequency, recipients: data.recipients, nextRunAt },
    })
  }

  async update(tenantId: string, id: string, data: { name?: string; frequency?: string; recipients?: string; enabled?: boolean }) {
    const schedule = await prisma.reportSchedule.findFirst({ where: { id, tenantId } })
    if (!schedule) throw new NotFoundException('Programación no encontrada')
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.frequency !== undefined) {
      updateData.frequency = data.frequency
      updateData.nextRunAt = this.calcNextRun(data.frequency)
    }
    if (data.recipients !== undefined) updateData.recipients = data.recipients
    if (data.enabled !== undefined) updateData.enabled = data.enabled
    return prisma.reportSchedule.update({ where: { id }, data: updateData })
  }

  async remove(tenantId: string, id: string) {
    const schedule = await prisma.reportSchedule.findFirst({ where: { id, tenantId } })
    if (!schedule) throw new NotFoundException('Programación no encontrada')
    await prisma.reportSchedule.delete({ where: { id } })
    return { deleted: true }
  }

  async markSent(tenantId: string, id: string) {
    const schedule = await prisma.reportSchedule.findFirst({ where: { id, tenantId } })
    if (!schedule) throw new NotFoundException('Programación no encontrada')
    return prisma.reportSchedule.update({
      where: { id },
      data: { lastSentAt: new Date(), nextRunAt: this.calcNextRun(schedule.frequency) },
    })
  }

  private calcNextRun(frequency: string): Date {
    const now = new Date()
    switch (frequency) {
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      case 'biweekly':
        return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1)
      case 'quarterly':
        return new Date(now.getFullYear(), now.getMonth() + 3 - (now.getMonth() % 3), 1)
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    }
  }
}
