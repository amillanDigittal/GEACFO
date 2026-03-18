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
}
