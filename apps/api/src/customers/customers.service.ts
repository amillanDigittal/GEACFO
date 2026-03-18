import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class CustomersService {
  async getAll(tenantId: string) {
    return prisma.customer.findMany({
      where: { tenantId },
      include: { invoices: true, scoreHistory: { take: 1, orderBy: { calculatedAt: 'desc' } } },
      orderBy: { creditScore: 'asc' },
    })
  }

  async getById(tenantId: string, id: string) {
    return prisma.customer.findFirst({
      where: { tenantId, id },
      include: { invoices: true, scoreHistory: { orderBy: { calculatedAt: 'asc' } } },
    })
  }

  async recalculateScore(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({ where: { tenantId, id: customerId }, include: { invoices: true } })
    if (!customer) throw new Error('Customer not found')
    const overdueCount = customer.invoices.filter(i => i.status === 'OVERDUE').length
    const baseScore = 100 - overdueCount * 15 - (customer.dso! > 60 ? 20 : customer.dso! > 45 ? 10 : 0)
    const score = Math.max(10, Math.min(100, baseScore))
    const riskLevel = score >= 80 ? 'LOW' : score >= 60 ? 'MEDIUM' : score >= 40 ? 'HIGH' : 'CRITICAL'
    await prisma.scoreHistory.create({
      data: {
        customerId, score, riskLevel: riskLevel as any,
        factors: { paymentHistory: score > 70 ? 88 : 45, dsoTrend: score > 70 ? 80 : 35, seniority: 72, financialCapacity: 85 }
      }
    })
    return prisma.customer.update({ where: { id: customerId }, data: { creditScore: score, riskLevel: riskLevel as any } })
  }
}
