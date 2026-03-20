import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function round2(n: number) { return Math.round(n * 100) / 100 }

@Injectable()
export class SuppliersService {
  async getAll(tenantId: string) {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      include: { invoices: true },
      orderBy: { name: 'asc' },
    })
    return suppliers.map(s => {
      const totalInvoices = s.invoices.length
      const totalVolume = s.invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0)
      const paidInvoices = s.invoices.filter(i => i.status === 'PAID')
      const pendingAmount = s.invoices.reduce((sum, i) => sum + Number(i.totalAmount) - Number(i.paidAmount), 0)
      return { ...s, invoices: undefined, totalInvoices, totalVolume: round2(totalVolume), paidCount: paidInvoices.length, pendingAmount: round2(pendingAmount) }
    })
  }

  async getById(tenantId: string, id: string) {
    return prisma.supplier.findFirst({
      where: { tenantId, id },
      include: { invoices: { orderBy: { dueDate: 'desc' }, take: 50 } },
    })
  }

  async create(tenantId: string, data: { code: string; name: string; nif?: string; email?: string; phone?: string; category?: string; paymentTerms?: number; notes?: string }) {
    return prisma.supplier.create({
      data: { tenantId, ...data, paymentTerms: data.paymentTerms || 30 },
    })
  }

  async update(tenantId: string, id: string, data: { name?: string; nif?: string; email?: string; phone?: string; category?: string; paymentTerms?: number; status?: string; notes?: string }) {
    const supplier = await prisma.supplier.findFirst({ where: { tenantId, id } })
    if (!supplier) throw new Error('Supplier not found')
    return prisma.supplier.update({ where: { id }, data: data as any })
  }

  async remove(tenantId: string, id: string) {
    const supplier = await prisma.supplier.findFirst({ where: { tenantId, id } })
    if (!supplier) throw new Error('Supplier not found')
    return prisma.supplier.delete({ where: { id } })
  }

  async recalculateScore(tenantId: string, id: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { tenantId, id },
      include: { invoices: true },
    })
    if (!supplier) throw new Error('Supplier not found')

    const invoices = supplier.invoices
    const total = invoices.length

    if (total === 0) {
      return prisma.supplier.update({
        where: { id },
        data: { reliabilityScore: 50, qualityScore: 50, deliveryScore: 50, overallScore: 50, riskLevel: 'MEDIUM' },
      })
    }

    // Reliability: % of invoices paid or approved (not rejected)
    const rejectedCount = invoices.filter(i => i.status === 'REJECTED').length
    const reliabilityScore = Math.round(((total - rejectedCount) / total) * 100)

    // Delivery: based on how consistently invoices arrive on expected terms
    // Simulate via payment terms adherence — lower avg variance = better
    const now = new Date()
    let onTimeCount = 0
    for (const inv of invoices) {
      const daysDiff = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      // If the invoice is not past due by more than 7 days, consider it "on time"
      if (daysDiff <= 7 || inv.status === 'PAID') onTimeCount++
    }
    const deliveryScore = Math.round((onTimeCount / total) * 100)

    // Quality: composite — no rejected, consistent amounts, no disputes
    // Higher volume + fewer issues = higher quality
    const avgAmount = invoices.reduce((s, i) => s + Number(i.totalAmount), 0) / total
    const variance = invoices.reduce((s, i) => s + Math.pow(Number(i.totalAmount) - avgAmount, 2), 0) / total
    const cv = avgAmount > 0 ? Math.sqrt(variance) / avgAmount : 1 // coefficient of variation
    const qualityScore = Math.min(100, Math.max(10, Math.round(100 - cv * 30 - rejectedCount * 15)))

    // Overall: weighted average
    const overallScore = Math.round(reliabilityScore * 0.4 + deliveryScore * 0.35 + qualityScore * 0.25)

    const riskLevel = overallScore >= 80 ? 'LOW' : overallScore >= 60 ? 'MEDIUM' : overallScore >= 40 ? 'HIGH' : 'CRITICAL'

    return prisma.supplier.update({
      where: { id },
      data: { reliabilityScore, qualityScore, deliveryScore, overallScore, riskLevel: riskLevel as any },
    })
  }

  async recalculateAll(tenantId: string) {
    const suppliers = await prisma.supplier.findMany({ where: { tenantId }, select: { id: true } })
    const results = await Promise.all(suppliers.map(s => this.recalculateScore(tenantId, s.id)))
    return { updated: results.length }
  }
}
