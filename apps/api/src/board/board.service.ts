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
    return {
      generatedAt: new Date(),
      sections: {
        executiveSummary: { cash: totalCash, revenue: 4820000, ebitdaMargin: 23.9, covenants: covenants.every(c => c.status === 'COMPLIANT'), alerts: alertCustomers.length },
        liquidity: { currentCash: totalCash, forecastedCash, gapWeeks: forecast.filter(w => w.isGap).map(w => w.weekNumber) },
        workingCapital: { dso: 42, dsoTarget: 45, dpo: 67, ccc: 28 },
        debt: { totalDebt: 2180000, netDebt: 2180000 - totalCash, allCovenants: covenants },
        customerRisk: { totalExposure: ar.reduce((s, i) => s + Number(i.totalAmount), 0), alertCustomers, avgScore: 75 },
      }
    }
  }
}
