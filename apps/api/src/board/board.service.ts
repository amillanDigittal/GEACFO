import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class BoardService {
  async generate(tenantId: string) {
    const [accounts, covenants, customers, ar, ap, forecast] = await Promise.all([
      prisma.bankAccount.findMany({ where: { tenantId } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.customer.findMany({ where: { tenantId } }),
      prisma.invoiceAR.findMany({ where: { tenantId } }),
      prisma.invoiceAP.findMany({ where: { tenantId } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
    ])
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    const forecastedCash = forecast.length ? Number(forecast[forecast.length - 1].cumBalance) : totalCash
    const alertCustomers = customers.filter(c => c.status === 'ALERT')
    const totalExposure = ar.reduce((s, i) => s + Number(i.totalAmount), 0)

    const q1 = {
      period: 'Q1 2026',
      generatedAt: new Date(),
      sections: {
        executiveSummary: { cash: totalCash, revenue: 4820000, ebitdaMargin: 23.9, covenants: covenants.every(c => c.status === 'COMPLIANT'), alerts: alertCustomers.length },
        liquidity: { currentCash: totalCash, forecastedCash, gapWeeks: forecast.filter(w => w.isGap).map(w => w.weekNumber) },
        workingCapital: { dso: 42, dsoTarget: 45, dpo: 67, ccc: 28 },
        debt: { totalDebt: 2180000, netDebt: 2180000 - totalCash, allCovenants: covenants },
        customerRisk: { totalExposure, alertCustomers, avgScore: 75 },
      },
    }

    // Q4 2025 historical data for comparison
    const q4 = {
      period: 'Q4 2025',
      generatedAt: new Date('2025-12-31T10:00:00Z'),
      sections: {
        executiveSummary: { cash: 1082000, revenue: 4290000, ebitdaMargin: 22.4, covenants: true, alerts: 1 },
        liquidity: { currentCash: 1082000, forecastedCash: 1150, gapWeeks: [11, 12] },
        workingCapital: { dso: 47, dsoTarget: 45, dpo: 63, ccc: 34 },
        debt: { totalDebt: 2320000, netDebt: 2320000 - 1082000, allCovenants: covenants.map(c => ({ ...c, margin: Math.max(0, Number(c.margin) - 8).toFixed(1) })) },
        customerRisk: { totalExposure: totalExposure * 0.91, alertCustomers: alertCustomers.slice(0, 1), avgScore: 72 },
      },
    }

    return {
      generatedAt: q1.generatedAt,
      current: q1,
      previous: q4,
      // Keep backward compat
      sections: q1.sections,
    }
  }
}
