import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class AlertsService {
  async getCounts(tenantId: string) {
    const [customers, invoicesAR, invoicesAP, covenants, inventory, dataSources, forecast] = await Promise.all([
      prisma.customer.findMany({ where: { tenantId }, include: { invoices: { where: { status: { not: 'PAID' } } } } }),
      prisma.invoiceAR.findMany({ where: { tenantId, status: 'OVERDUE' } }),
      prisma.invoiceAP.findMany({ where: { tenantId, status: 'IN_REVIEW', priority: 'HIGH' } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.inventoryItem.findMany({ where: { tenantId, status: { in: ['CRITICAL', 'OBSOLETE'] } } }),
      prisma.dataSource.findMany({ where: { tenantId, status: { in: ['WARNING', 'ERROR'] } } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE', isGap: true } }),
    ])

    const riskCustomers = customers.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL' || c.status === 'ALERT' || c.status === 'SUSPENDED')

    let fraudeAlerts = riskCustomers.length
    customers.forEach(c => {
      const exposure = c.invoices?.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0) || 0
      if (Number(c.creditLimit) > 0 && exposure > Number(c.creditLimit)) fraudeAlerts++
    })
    if (invoicesAP.length > 0) fraudeAlerts++

    return {
      scoring: riskCustomers.length,
      fraude: fraudeAlerts,
      cobros: invoicesAR.length,
      pagos: invoicesAP.length,
      forecast: forecast.length,
      inventario: inventory.length,
      gobierno: dataSources.length,
      deuda: covenants.filter(c => Number(c.margin) < 15).length,
    }
  }

  async getNotifications(tenantId: string) {
    const [customers, invoicesAR, invoicesAP, covenants, inventory, dataSources, forecast] = await Promise.all([
      prisma.customer.findMany({ where: { tenantId }, include: { invoices: { where: { status: { not: 'PAID' } } } } }),
      prisma.invoiceAR.findMany({ where: { tenantId, status: 'OVERDUE' }, include: { customer: true } }),
      prisma.invoiceAP.findMany({ where: { tenantId }, include: { supplier: true } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.inventoryItem.findMany({ where: { tenantId, status: { in: ['CRITICAL', 'OBSOLETE'] } } }),
      prisma.dataSource.findMany({ where: { tenantId, status: { in: ['WARNING', 'ERROR'] } } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE', isGap: true }, orderBy: { weekNumber: 'asc' } }),
    ])

    const notifications: any[] = []
    const now = Date.now()

    // Forecast gaps
    if (forecast.length > 0) {
      notifications.push({
        id: 'forecast-gaps',
        type: 'forecast',
        severity: 'critical',
        icon: '🚨',
        title: `${forecast.length} semana${forecast.length > 1 ? 's' : ''} con déficit de caja`,
        description: `Semanas ${forecast.map(w => 'S' + w.weekNumber).join(', ')} tienen pagos superiores a cobros`,
        link: '/dashboard/forecast',
        timestamp: new Date().toISOString(),
      })
    }

    // Overdue AR invoices
    invoicesAR.forEach(inv => {
      const days = Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000)
      const pending = Number(inv.totalAmount) - Number(inv.paidAmount)
      notifications.push({
        id: `ar-overdue-${inv.id}`,
        type: 'cobros',
        severity: days > 60 ? 'critical' : 'warning',
        icon: days > 60 ? '🚨' : '⚠️',
        title: `Factura ${inv.number} vencida (${days}d)`,
        description: `${(inv as any).customer?.name} · Pendiente: ${pending.toLocaleString('es-ES')} €`,
        link: '/dashboard/cobros',
        timestamp: inv.dueDate,
      })
    })

    // AP due soon (next 3 days)
    invoicesAP.forEach(inv => {
      if (inv.status === 'PAID') return
      const daysUntil = Math.ceil((new Date(inv.dueDate).getTime() - now) / 86400000)
      if (daysUntil >= 0 && daysUntil <= 3) {
        notifications.push({
          id: `ap-due-${inv.id}`,
          type: 'pagos',
          severity: 'warning',
          icon: '⏰',
          title: `Pago ${inv.number} vence ${daysUntil === 0 ? 'hoy' : `en ${daysUntil}d`}`,
          description: `${(inv as any).supplier?.name} · ${Number(inv.totalAmount).toLocaleString('es-ES')} € · ${inv.status === 'APPROVED' ? 'Aprobada' : 'Pendiente aprobación'}`,
          link: '/dashboard/pagos',
          timestamp: inv.dueDate,
        })
      }
    })

    // AP high-priority unapproved
    const highPriorityAP = invoicesAP.filter(i => i.priority === 'HIGH' && i.status === 'IN_REVIEW')
    if (highPriorityAP.length > 0) {
      notifications.push({
        id: 'ap-high-priority',
        type: 'pagos',
        severity: 'warning',
        icon: '⚡',
        title: `${highPriorityAP.length} pago${highPriorityAP.length > 1 ? 's' : ''} de alta prioridad sin aprobar`,
        description: highPriorityAP.map(i => `${i.number} (${(i as any).supplier?.name})`).join(', '),
        link: '/dashboard/pagos',
        timestamp: new Date().toISOString(),
      })
    }

    // Covenant alerts
    covenants.forEach(cov => {
      const margin = Number(cov.margin)
      if (margin < 20) {
        notifications.push({
          id: `covenant-${cov.id}`,
          type: 'deuda',
          severity: margin < 10 ? 'critical' : 'warning',
          icon: margin < 10 ? '🚨' : '⚠️',
          title: `Covenant "${cov.name}" con margen ${margin}%`,
          description: `Actual: ${cov.currentValue} · Límite: ${cov.limitValue} (${cov.limitType})`,
          link: '/dashboard/deuda',
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Risk customers
    const riskCustomers = customers.filter(c => c.riskLevel === 'CRITICAL' || c.status === 'ALERT' || c.status === 'SUSPENDED')
    riskCustomers.forEach(c => {
      notifications.push({
        id: `customer-risk-${c.id}`,
        type: 'scoring',
        severity: c.riskLevel === 'CRITICAL' ? 'critical' : 'warning',
        icon: c.riskLevel === 'CRITICAL' ? '🚨' : '⚠️',
        title: `Cliente en riesgo: ${c.name}`,
        description: `Score: ${c.creditScore || 'N/A'} · DSO: ${c.dso || 0}d · Estado: ${c.status}`,
        link: '/dashboard/scoring',
        timestamp: c.updatedAt,
      })
    })

    // Inventory alerts
    if (inventory.length > 0) {
      const critical = inventory.filter(i => i.status === 'CRITICAL')
      const obsolete = inventory.filter(i => i.status === 'OBSOLETE')
      if (critical.length > 0) {
        notifications.push({
          id: 'inv-critical',
          type: 'inventario',
          severity: 'critical',
          icon: '🚨',
          title: `${critical.length} item${critical.length > 1 ? 's' : ''} en nivel crítico`,
          description: critical.map(i => `${i.sku}: ${i.stock} uds`).join(', '),
          link: '/dashboard/inventario',
          timestamp: new Date().toISOString(),
        })
      }
      if (obsolete.length > 0) {
        notifications.push({
          id: 'inv-obsolete',
          type: 'inventario',
          severity: 'info',
          icon: '📦',
          title: `${obsolete.length} item${obsolete.length > 1 ? 's' : ''} obsoleto${obsolete.length > 1 ? 's' : ''}`,
          description: `Valor inmovilizado: ${obsolete.reduce((s, i) => s + Number(i.totalValue), 0).toLocaleString('es-ES')} €`,
          link: '/dashboard/inventario',
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Data source issues
    dataSources.forEach(ds => {
      notifications.push({
        id: `ds-${ds.id}`,
        type: 'gobierno',
        severity: ds.status === 'ERROR' ? 'critical' : 'info',
        icon: ds.status === 'ERROR' ? '❌' : '⚠️',
        title: `Fuente "${ds.name}" con ${ds.status === 'ERROR' ? 'error' : 'advertencia'}`,
        description: `${ds.recordCount?.toLocaleString('es-ES')} registros · Última sync: ${ds.lastSync ? new Date(ds.lastSync).toLocaleString('es-ES') : 'nunca'}`,
        link: '/dashboard/gobierno',
        timestamp: ds.lastSync || new Date().toISOString(),
      })
    })

    // Sort: critical first, then warning, then info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    notifications.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))

    return notifications
  }

  async getResolutions(tenantId: string) {
    return prisma.alertResolution.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async updateResolution(tenantId: string, email: string, alertId: string, status: string, notes?: string) {
    const isResolved = status === 'RESOLVED' || status === 'FALSE_POSITIVE'
    return prisma.alertResolution.upsert({
      where: { tenantId_alertId: { tenantId, alertId } },
      update: {
        status: status as any,
        notes,
        resolvedBy: isResolved ? email : null,
        resolvedAt: isResolved ? new Date() : null,
      },
      create: {
        tenantId,
        alertId,
        status: status as any,
        notes,
        resolvedBy: isResolved ? email : null,
        resolvedAt: isResolved ? new Date() : null,
      },
    })
  }
}
