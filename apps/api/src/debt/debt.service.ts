import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NOTIFICATION_EVENTS, NotificationEvent } from '../notifications/notification-events'
const prisma = new PrismaClient()

@Injectable()
export class DebtService {
  constructor(private eventEmitter: EventEmitter2) {}

  async checkCovenantRisks(tenantId: string) {
    const covenants = await prisma.covenant.findMany({ where: { tenantId } })
    for (const cov of covenants) {
      const margin = Number(cov.margin)
      if (margin < 10) {
        this.eventEmitter.emit(NOTIFICATION_EVENTS.COVENANT_RISK, {
          tenantId,
          type: 'covenant_risk',
          severity: 'critical',
          title: `Covenant "${cov.name}" en riesgo — margen ${margin}%`,
          description: `Actual: ${cov.currentValue} · Límite: ${cov.limitValue} (${cov.limitType})`,
          link: '/dashboard/deuda',
          timestamp: new Date().toISOString(),
        } as NotificationEvent)
      }
    }
  }
  async getInstruments(tenantId: string) {
    return prisma.debtInstrument.findMany({ where: { tenantId }, include: { covenants: true } })
  }
  async getCovenants(tenantId: string) {
    return prisma.covenant.findMany({ where: { tenantId }, include: { debtInstrument: true } })
  }
  async getSummary(tenantId: string) {
    const instruments = await prisma.debtInstrument.findMany({ where: { tenantId } })
    const covenants = await prisma.covenant.findMany({ where: { tenantId } })
    const totalDebt = instruments.reduce((s, i) => s + Number(i.outstanding), 0)
    const avgRate = instruments.length ? instruments.reduce((s, i) => s + Number(i.interestRate), 0) / instruments.length : 0
    const accounts = await prisma.bankAccount.findMany({ where: { tenantId } })
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    return { totalDebt, netDebt: totalDebt - totalCash, avgRate, instruments, covenants, allCompliant: covenants.every(c => c.status === 'COMPLIANT') }
  }

  async getAmortizationSchedule(tenantId: string) {
    const instruments = await prisma.debtInstrument.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { maturityDate: 'asc' },
    })
    const now = new Date()
    const months: { month: string; [key: string]: any }[] = []

    // Generate monthly schedule for the next 24 months
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry: any = { month: label }
      for (const inst of instruments) {
        const maturity = new Date(inst.maturityDate)
        const outstanding = Number(inst.outstanding)
        const totalMonths = Math.max(1, Math.round((maturity.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
        const monthlyPayment = outstanding / totalMonths
        entry[inst.id] = d <= maturity ? Math.round(monthlyPayment) : 0
      }
      months.push(entry)
    }

    const timeline = instruments.map(inst => ({
      id: inst.id,
      type: inst.type,
      bank: inst.bank,
      outstanding: Number(inst.outstanding),
      totalAmount: Number(inst.totalAmount),
      interestRate: Number(inst.interestRate),
      maturityDate: inst.maturityDate,
      monthsRemaining: Math.max(0, Math.round((new Date(inst.maturityDate).getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000))),
    }))

    return {
      schedule: months,
      instruments: timeline,
    }
  }
}
