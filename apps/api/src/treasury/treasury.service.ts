import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class TreasuryService {
  async getCockpitKPIs(tenantId: string) {
    const [accounts, invoicesAR, invoicesAP, forecast, movements] = await Promise.all([
      prisma.bankAccount.findMany({ where: { tenantId } }),
      prisma.invoiceAR.findMany({ where: { tenantId } }),
      prisma.invoiceAP.findMany({ where: { tenantId } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
      prisma.bankMovement.findMany({
        where: { bankAccount: { tenantId } },
        orderBy: { date: 'asc' },
        include: { bankAccount: { select: { alias: true } } },
      }),
    ])
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    const totalAR = invoicesAR.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const totalAP = invoicesAP.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const arCount = invoicesAR.filter(i => i.status !== 'PAID').length
    const dso = arCount > 0 ? 42 : 0
    const forecastedCash = forecast.length > 0 ? Number(forecast[forecast.length - 1].cumBalance) : totalCash

    // Build daily cash evolution from movements (aggregate by date)
    const dailyMap = new Map<string, number>()
    movements.forEach(m => {
      const day = new Date(m.date).toISOString().slice(0, 10)
      dailyMap.set(day, (dailyMap.get(day) || 0) + Number(m.amount))
    })
    const sortedDays = [...dailyMap.keys()].sort()
    let runningBalance = totalCash - [...dailyMap.values()].reduce((s, v) => s + v, 0)
    const cashEvolution = sortedDays.map(day => {
      runningBalance += dailyMap.get(day)!
      return { date: day, balance: Math.round(runningBalance) }
    })
    // Add current balance as last point if not already there
    const today = new Date().toISOString().slice(0, 10)
    if (cashEvolution.length === 0 || cashEvolution[cashEvolution.length - 1].date !== today) {
      cashEvolution.push({ date: today, balance: totalCash })
    }

    // Sparkline data for KPIs (simulated trend points based on forecast)
    const cajaSparkline = forecast.slice(0, 8).map(w => Number(w.cumBalance) * 1000)
    if (cajaSparkline.length === 0) cajaSparkline.push(totalCash)
    const revenueSparkline = [3800, 4050, 4200, 4350, 4520, 4650, 4820].map(v => v * 1000)
    const ebitdaSparkline = [880, 920, 960, 1020, 1080, 1120, 1150].map(v => v * 1000)
    const deudaSparkline = [2350, 2320, 2290, 2260, 2230, 2210, 2180].map(v => v * 1000)
    const dsoSparkline = [48, 46, 45, 44, 43, 42, 42]
    const dpoSparkline = [62, 63, 64, 65, 66, 66, 67]
    const cccSparkline = [35, 33, 31, 30, 29, 28, 28]
    const liquidezSparkline = [1.72, 1.75, 1.78, 1.80, 1.82, 1.84, 1.85]

    return {
      caja: { value: totalCash, accounts: accounts.map(a => ({ name: a.alias, balance: Number(a.balance) })), sparkline: cajaSparkline },
      dso: { value: dso, target: 45, trend: dso < 45 ? 'up' : 'down', sparkline: dsoSparkline },
      dpo: { value: 67, trend: 'up', sparkline: dpoSparkline },
      ccc: { value: 28, trend: 'up', sparkline: cccSparkline },
      revenue: { value: 4820000, trend: 12.3, sparkline: revenueSparkline },
      ebitda: { value: 1150000, margin: 23.9, trend: 0.8, sparkline: ebitdaSparkline },
      deudaNeta: { value: 2180000, trend: -1.2, sparkline: deudaSparkline },
      liquidez: { value: 1.85, trend: 0.05, sparkline: liquidezSparkline },
      workingCapital: { ar: totalAR, ap: totalAP, forecast: forecastedCash },
      cashEvolution,
    }
  }

  async getForecast(tenantId: string, scenario: string = 'BASE') {
    const weeks = await prisma.forecastWeek.findMany({
      where: { tenantId, scenario: scenario.toUpperCase() },
      orderBy: { weekNumber: 'asc' },
    })
    const accounts = await prisma.bankAccount.findMany({ where: { tenantId } })
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    return { initialCash: totalCash, weeks, scenario }
  }

  async getForecastComparison(tenantId: string) {
    const [base, conservador, agresivo, accounts] = await Promise.all([
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'CONSERVADOR' }, orderBy: { weekNumber: 'asc' } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'AGRESIVO' }, orderBy: { weekNumber: 'asc' } }),
      prisma.bankAccount.findMany({ where: { tenantId } }),
    ])
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)

    const maxWeeks = Math.max(base.length, conservador.length, agresivo.length)
    const weeks = []
    for (let i = 0; i < maxWeeks; i++) {
      const b = base[i]
      const c = conservador[i]
      const a = agresivo[i]
      weeks.push({
        weekNumber: b?.weekNumber || c?.weekNumber || a?.weekNumber || i + 1,
        base: b ? { inflows: Number(b.inflows), outflows: Number(b.outflows), cumBalance: Number(b.cumBalance), isGap: b.isGap, confidence: Number(b.confidence) } : null,
        conservador: c ? { inflows: Number(c.inflows), outflows: Number(c.outflows), cumBalance: Number(c.cumBalance), isGap: c.isGap, confidence: Number(c.confidence) } : null,
        agresivo: a ? { inflows: Number(a.inflows), outflows: Number(a.outflows), cumBalance: Number(a.cumBalance), isGap: a.isGap, confidence: Number(a.confidence) } : null,
      })
    }
    return { initialCash: totalCash, weeks }
  }

  async getBankAccounts(tenantId: string) {
    return prisma.bankAccount.findMany({
      where: { tenantId },
      include: { movements: { take: 20, orderBy: { date: 'desc' } } },
    })
  }

  async getReconciliation(tenantId: string) {
    return prisma.reconciliation.findMany({
      where: { bankAccount: { tenantId } },
      include: { bankAccount: true },
      orderBy: { periodDate: 'desc' },
    })
  }

  async getInvoicesAR(tenantId: string) {
    return prisma.invoiceAR.findMany({
      where: { tenantId },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    })
  }

  async getInvoicesAP(tenantId: string) {
    return prisma.invoiceAP.findMany({
      where: { tenantId },
      include: { supplier: true },
      orderBy: { dueDate: 'asc' },
    })
  }

  async approveInvoiceAP(id: string, userId: string) {
    return prisma.invoiceAP.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    })
  }

  async approveInvoicesAPBatch(ids: string[], userId: string) {
    return prisma.invoiceAP.updateMany({
      where: { id: { in: ids }, status: 'IN_REVIEW' },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    })
  }

  async reconcileMovement(id: string, tenantId: string) {
    const movement = await prisma.bankMovement.findFirst({
      where: { id, bankAccount: { tenantId } },
      include: { bankAccount: true },
    })
    if (!movement) throw new Error('Movimiento no encontrado')
    return prisma.bankMovement.update({
      where: { id },
      data: { reconciled: !movement.reconciled },
    })
  }

  async reconcileMovements(ids: string[], tenantId: string) {
    const movements = await prisma.bankMovement.findMany({
      where: { id: { in: ids }, bankAccount: { tenantId } },
    })
    if (movements.length === 0) throw new Error('Movimientos no encontrados')
    const allReconciled = movements.every(m => m.reconciled)
    await prisma.bankMovement.updateMany({
      where: { id: { in: ids }, bankAccount: { tenantId } },
      data: { reconciled: !allReconciled },
    })
    return { updated: movements.length, reconciled: !allReconciled }
  }
}
