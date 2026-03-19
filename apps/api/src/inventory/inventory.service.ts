import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class InventoryService {
  async getAll(tenantId: string) {
    const items = await prisma.inventoryItem.findMany({ where: { tenantId }, orderBy: { rotationDays: 'desc' } })
    const totalValue = items.reduce((s, i) => s + Number(i.totalValue), 0)
    const obsolete = items.filter(i => i.status === 'OBSOLETE')
    const critical = items.filter(i => i.status === 'CRITICAL')
    return { items, totalValue, obsoleteCount: obsolete.length, criticalCount: critical.length }
  }

  async getAbcAnalysis(tenantId: string) {
    const items = await prisma.inventoryItem.findMany({ where: { tenantId }, orderBy: { totalValue: 'desc' } })
    const totalValue = items.reduce((s, i) => s + Number(i.totalValue), 0)
    if (totalValue === 0) return { items: [], summary: { A: { count: 0, value: 0, pct: 0 }, B: { count: 0, value: 0, pct: 0 }, C: { count: 0, value: 0, pct: 0 } }, totalValue: 0 }

    let cumValue = 0
    const classified = items.map(item => {
      const value = Number(item.totalValue)
      cumValue += value
      const cumPct = (cumValue / totalValue) * 100
      const category = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C'

      const stock = Number(item.stock)
      const rotation = item.rotationDays || 0
      const dailyUsage = rotation > 0 ? stock / rotation : 0
      const coverageDays = rotation
      const safetyStock = Math.ceil(dailyUsage * 7)
      const reorderPoint = Math.ceil(dailyUsage * 14) + safetyStock

      let reorderRecommendation: string
      if (item.status === 'OBSOLETE') {
        reorderRecommendation = 'Liquidar — No reponer'
      } else if (stock <= safetyStock && stock > 0) {
        reorderRecommendation = `Urgente — Stock bajo mínimo de seguridad (${safetyStock} uds)`
      } else if (stock <= reorderPoint) {
        reorderRecommendation = `Reponer — Stock por debajo del punto de pedido (${reorderPoint} uds)`
      } else if (category === 'A') {
        reorderRecommendation = `Control estricto — Revisar semanalmente (PR: ${reorderPoint} uds)`
      } else if (category === 'B') {
        reorderRecommendation = `Control periódico — Revisar quincenalmente (PR: ${reorderPoint} uds)`
      } else {
        reorderRecommendation = `Control básico — Revisar mensualmente (PR: ${reorderPoint} uds)`
      }

      return {
        id: item.id,
        sku: item.sku,
        description: item.description,
        stock,
        unitCost: Number(item.unitCost),
        totalValue: value,
        valuePct: (value / totalValue) * 100,
        cumPct,
        rotationDays: rotation,
        status: item.status,
        warehouse: item.warehouse,
        category,
        dailyUsage: Math.round(dailyUsage * 100) / 100,
        coverageDays,
        safetyStock,
        reorderPoint,
        reorderRecommendation,
      }
    })

    const summary = { A: { count: 0, value: 0, pct: 0 }, B: { count: 0, value: 0, pct: 0 }, C: { count: 0, value: 0, pct: 0 } }
    classified.forEach(i => {
      const cat = i.category as 'A' | 'B' | 'C'
      summary[cat].count++
      summary[cat].value += i.totalValue
    })
    summary.A.pct = (summary.A.value / totalValue) * 100
    summary.B.pct = (summary.B.value / totalValue) * 100
    summary.C.pct = (summary.C.value / totalValue) * 100

    return { items: classified, summary, totalValue }
  }
}
