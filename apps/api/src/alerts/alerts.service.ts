import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NOTIFICATION_EVENTS, NotificationEvent } from '../notifications/notification-events'
const prisma = new PrismaClient()

@Injectable()
export class AlertsService {
  constructor(private eventEmitter: EventEmitter2) {}
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

  async getPredictive(tenantId: string) {
    const [forecast, covenants, customers, invoicesAR, accounts] = await Promise.all([
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.customer.findMany({ where: { tenantId }, include: { invoices: { where: { status: { not: 'PAID' } } } } }),
      prisma.invoiceAR.findMany({ where: { tenantId, status: { notIn: ['PAID', 'CANCELLED'] } }, include: { customer: true } }),
      prisma.bankAccount.findMany({ where: { tenantId } }),
    ])

    const alerts: {
      id: string; category: string; severity: 'critical' | 'warning' | 'info';
      title: string; description: string; prediction: string;
      weeksAhead: number | null; metric: string; currentValue: number; projectedValue: number; threshold: number;
      link: string; confidence: number;
    }[] = []

    const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)

    // ─── 1. FORECAST: predict when cash goes negative ─────────────────
    if (forecast.length >= 3) {
      // Find first week where cumBalance goes negative
      const negativeWeek = forecast.find(w => Number(w.cumBalance) < 0)
      if (negativeWeek) {
        alerts.push({
          id: 'pred-cash-negative',
          category: 'forecast',
          severity: 'critical',
          title: 'Caja negativa prevista',
          description: `El saldo acumulado será negativo en la Semana ${negativeWeek.weekNumber} (${Math.abs(Number(negativeWeek.cumBalance)).toLocaleString('es-ES')} € de déficit)`,
          prediction: `Sin acción correctora, la caja entrará en números rojos en ${negativeWeek.weekNumber} semanas`,
          weeksAhead: negativeWeek.weekNumber,
          metric: 'Saldo Acumulado',
          currentValue: totalCash,
          projectedValue: Number(negativeWeek.cumBalance),
          threshold: 0,
          link: '/dashboard/forecast',
          confidence: Number(negativeWeek.confidence) || 75,
        })
      }

      // Cash falling below safety threshold (200k)
      const safetyThreshold = 200000
      const belowSafety = forecast.find(w => Number(w.cumBalance) < safetyThreshold && Number(w.cumBalance) >= 0)
      if (belowSafety && !negativeWeek) {
        alerts.push({
          id: 'pred-cash-low',
          category: 'forecast',
          severity: 'warning',
          title: 'Caja por debajo del mínimo de seguridad',
          description: `El saldo bajará a ${Number(belowSafety.cumBalance).toLocaleString('es-ES')} € en Semana ${belowSafety.weekNumber}`,
          prediction: `La caja caerá por debajo de ${safetyThreshold.toLocaleString('es-ES')} € (umbral de seguridad) en ${belowSafety.weekNumber} semanas`,
          weeksAhead: belowSafety.weekNumber,
          metric: 'Saldo Acumulado',
          currentValue: totalCash,
          projectedValue: Number(belowSafety.cumBalance),
          threshold: safetyThreshold,
          link: '/dashboard/forecast',
          confidence: Number(belowSafety.confidence) || 70,
        })
      }

      // Trend: outflows growing faster than inflows
      if (forecast.length >= 6) {
        const firstHalf = forecast.slice(0, Math.floor(forecast.length / 2))
        const secondHalf = forecast.slice(Math.floor(forecast.length / 2))
        const avgOutFirst = firstHalf.reduce((s, w) => s + Number(w.outflows), 0) / firstHalf.length
        const avgOutSecond = secondHalf.reduce((s, w) => s + Number(w.outflows), 0) / secondHalf.length
        const avgInFirst = firstHalf.reduce((s, w) => s + Number(w.inflows), 0) / firstHalf.length
        const avgInSecond = secondHalf.reduce((s, w) => s + Number(w.inflows), 0) / secondHalf.length

        const outflowGrowth = avgOutFirst > 0 ? ((avgOutSecond - avgOutFirst) / avgOutFirst) * 100 : 0
        const inflowGrowth = avgInFirst > 0 ? ((avgInSecond - avgInFirst) / avgInFirst) * 100 : 0

        if (outflowGrowth > 10 && outflowGrowth > inflowGrowth + 5) {
          alerts.push({
            id: 'pred-outflow-trend',
            category: 'forecast',
            severity: 'warning',
            title: 'Tendencia de gastos acelerada',
            description: `Los pagos crecen +${outflowGrowth.toFixed(1)}% mientras los cobros crecen +${inflowGrowth.toFixed(1)}%`,
            prediction: 'Si la tendencia continúa, el gap entre cobros y pagos se ampliará progresivamente',
            weeksAhead: null,
            metric: 'Crecimiento Pagos vs Cobros',
            currentValue: avgOutFirst,
            projectedValue: avgOutSecond,
            threshold: avgInSecond,
            link: '/dashboard/forecast',
            confidence: 65,
          })
        }
      }
    }

    // ─── 2. COVENANTS: project breach date ────────────────────────────
    for (const cov of covenants) {
      const margin = Number(cov.margin)
      const current = Number(cov.currentValue)
      const limit = Number(cov.limitValue)
      const isMax = cov.limitType === 'MAX'

      // Simulate trend based on current trajectory
      // If margin is shrinking (trend DETERIORATING or margin < 30), project forward
      if (margin < 30 && margin > 0) {
        // Estimate weeks to breach assuming margin shrinks linearly
        // Conservative: assume margin reduces by ~2-3% per month
        const weeklyMarginLoss = (cov.trend === 'DETERIORATING' || cov.trend === 'STABLE') ? 0.8 : 0.3
        const weeksToBreak = Math.ceil(margin / weeklyMarginLoss)

        if (weeksToBreak <= 26) {
          const projectedValue = isMax
            ? current + (current * (margin / 100) * (1 - weeksToBreak * weeklyMarginLoss / margin))
            : current - (current * (margin / 100) * (1 - weeksToBreak * weeklyMarginLoss / margin))

          alerts.push({
            id: `pred-covenant-${cov.id}`,
            category: 'deuda',
            severity: weeksToBreak <= 8 ? 'critical' : 'warning',
            title: `Covenant "${cov.name}" en riesgo de incumplimiento`,
            description: `Margen actual: ${margin}% · Límite: ${limit} (${cov.limitType})`,
            prediction: `Al ritmo actual, se incumplirá en aproximadamente ${weeksToBreak} semanas (~${Math.ceil(weeksToBreak / 4)} meses)`,
            weeksAhead: weeksToBreak,
            metric: cov.name,
            currentValue: current,
            projectedValue: Number(projectedValue.toFixed(4)),
            threshold: Number(limit),
            link: '/dashboard/deuda',
            confidence: weeksToBreak <= 8 ? 80 : 60,
          })
        }
      }
    }

    // ─── 3. DSO: predict when it exceeds target ──────────────────────
    const dsoTarget = 45
    const now = new Date()
    const totalAR = invoicesAR.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const revenue30d = 4820000 / 12 // Monthly revenue estimate
    const currentDSO = revenue30d > 0 ? (totalAR / revenue30d) * 30 : 0

    // Check overdue trend: count invoices that will become overdue in next weeks
    const upcomingOverdue: { week: number; count: number; amount: number }[] = []
    for (let w = 1; w <= 8; w++) {
      const cutoff = new Date(now.getTime() + w * 7 * 86400000)
      const willBeOverdue = invoicesAR.filter(i => {
        const due = new Date(i.dueDate)
        return due <= cutoff && due > now && i.status !== 'OVERDUE'
      })
      if (willBeOverdue.length > 0) {
        const amount = willBeOverdue.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
        upcomingOverdue.push({ week: w, count: willBeOverdue.length, amount })
      }
    }

    // Project DSO growth
    if (upcomingOverdue.length > 0) {
      const totalUpcoming = upcomingOverdue.reduce((s, u) => s + u.amount, 0)
      const projectedAR = totalAR + totalUpcoming
      const projectedDSO = revenue30d > 0 ? (projectedAR / revenue30d) * 30 : 0

      if (projectedDSO > dsoTarget && currentDSO <= dsoTarget) {
        const firstBreach = upcomingOverdue[0]
        alerts.push({
          id: 'pred-dso-breach',
          category: 'scoring',
          severity: 'warning',
          title: `DSO superará objetivo de ${dsoTarget} días`,
          description: `${upcomingOverdue.reduce((s, u) => s + u.count, 0)} facturas vencerán en las próximas semanas (+${totalUpcoming.toLocaleString('es-ES')} € de AR)`,
          prediction: `El DSO pasará de ${Math.round(currentDSO)}d a ~${Math.round(projectedDSO)}d en ${firstBreach.week} semanas si no se cobran`,
          weeksAhead: firstBreach.week,
          metric: 'DSO',
          currentValue: Math.round(currentDSO),
          projectedValue: Math.round(projectedDSO),
          threshold: dsoTarget,
          link: '/dashboard/scoring',
          confidence: 75,
        })
      } else if (projectedDSO > dsoTarget * 1.2) {
        alerts.push({
          id: 'pred-dso-critical',
          category: 'scoring',
          severity: 'critical',
          title: `DSO se disparará un ${Math.round(((projectedDSO - currentDSO) / currentDSO) * 100)}%`,
          description: `Gran volumen de vencimientos próximos: ${totalUpcoming.toLocaleString('es-ES')} €`,
          prediction: `El DSO podría alcanzar ~${Math.round(projectedDSO)} días (${Math.round(projectedDSO / dsoTarget * 100)}% del objetivo)`,
          weeksAhead: upcomingOverdue[0]?.week || 2,
          metric: 'DSO',
          currentValue: Math.round(currentDSO),
          projectedValue: Math.round(projectedDSO),
          threshold: dsoTarget,
          link: '/dashboard/cobros',
          confidence: 70,
        })
      }
    }

    // ─── 4. CUSTOMER CONCENTRATION RISK ──────────────────────────────
    if (totalAR > 0) {
      const byCustomer = new Map<string, { name: string; amount: number }>()
      for (const inv of invoicesAR) {
        const cName = inv.customer?.name || 'Desconocido'
        const cur = byCustomer.get(inv.customerId) || { name: cName, amount: 0 }
        cur.amount += Number(inv.totalAmount) - Number(inv.paidAmount)
        byCustomer.set(inv.customerId, cur)
      }
      const topCustomer = [...byCustomer.values()].sort((a, b) => b.amount - a.amount)[0]
      if (topCustomer) {
        const concentration = (topCustomer.amount / totalAR) * 100
        if (concentration > 40) {
          alerts.push({
            id: 'pred-concentration',
            category: 'scoring',
            severity: concentration > 60 ? 'critical' : 'warning',
            title: 'Riesgo de concentración de cobros',
            description: `${topCustomer.name} supone el ${concentration.toFixed(0)}% del AR pendiente (${topCustomer.amount.toLocaleString('es-ES')} €)`,
            prediction: 'Si este cliente retrasa pagos, el impacto en caja será desproporcionado',
            weeksAhead: null,
            metric: 'Concentración AR',
            currentValue: concentration,
            projectedValue: concentration,
            threshold: 40,
            link: '/dashboard/scoring',
            confidence: 90,
          })
        }
      }
    }

    // Sort by severity, then by weeksAhead
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => {
      const sd = severityOrder[a.severity] - severityOrder[b.severity]
      if (sd !== 0) return sd
      return (a.weeksAhead ?? 99) - (b.weeksAhead ?? 99)
    })

    return { alerts, generatedAt: new Date().toISOString() }
  }

  async getResolutions(tenantId: string) {
    return prisma.alertResolution.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async updateResolution(tenantId: string, email: string, alertId: string, status: string, notes?: string) {
    const isResolved = status === 'RESOLVED' || status === 'FALSE_POSITIVE'
    const result = await prisma.alertResolution.upsert({
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
    this.eventEmitter.emit(NOTIFICATION_EVENTS.ALERT_RESOLVED, {
      tenantId,
      type: 'alert_resolved',
      severity: 'info',
      title: `Alerta ${alertId} — ${status === 'RESOLVED' ? 'resuelta' : status === 'FALSE_POSITIVE' ? 'falso positivo' : 'actualizada'}`,
      description: notes || `Estado cambiado a ${status}`,
      link: '/dashboard/notificaciones',
      timestamp: new Date().toISOString(),
    } as NotificationEvent)
    return result
  }
}
