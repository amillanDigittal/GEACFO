import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class ScenariosService {
  async compare(tenantId: string) {
    const scenarios = ['BASE', 'CONSERVADOR', 'AGRESIVO']
    const results = await Promise.all(scenarios.map(async (s) => {
      const weeks = await prisma.forecastWeek.findMany({ where: { tenantId, scenario: s }, orderBy: { weekNumber: 'asc' } })
      const finalCash = weeks.length ? Number(weeks[weeks.length - 1].cumBalance) : 0
      const totalInflows = weeks.reduce((sum, w) => sum + Number(w.inflows), 0)
      const totalOutflows = weeks.reduce((sum, w) => sum + Number(w.outflows), 0)
      return { scenario: s, finalCash, totalInflows, totalOutflows, weeks }
    }))
    return results
  }

  async simulate(tenantId: string, params: { dso?: number; revenueChange?: number }) {
    const baseForecast = await prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } })
    const mult = params.revenueChange ? 1 + params.revenueChange / 100 : 1
    const dsoImpact = params.dso ? ((42 - params.dso) / 365) * 4820000 : 0
    const accounts = await prisma.bankAccount.findMany({ where: { tenantId } })
    const baseCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    const projectedCash = baseCash + dsoImpact + (baseForecast.length ? Number(baseForecast[baseForecast.length - 1].cumBalance) - baseCash : 0) * mult
    return { projectedCash, dsoImpact, revenueImpact: dsoImpact * mult - dsoImpact, covenantRisk: projectedCash < 500000 }
  }

  async getVariance(tenantId: string) {
    return {
      categories: ['Revenue', 'COGS', 'Margen Bruto', 'Gastos Personal', 'EBITDA', 'Tesorería'],
      actual:    [4820000, 2890000, 1930000, 680000, 1150000, 1245000],
      budget:    [4500000, 2700000, 1800000, 650000, 1050000, 1100000],
      prevYear:  [4290000, 2650000, 1640000, 620000, 920000, 980000],
    }
  }
}
