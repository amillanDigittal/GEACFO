import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class TreasuryService {
  async getCockpitKPIs(tenantId: string) {
    const [accounts, invoicesAR, invoicesAP, forecast, movements, customers, covenants] = await Promise.all([
      prisma.bankAccount.findMany({ where: { tenantId } }),
      prisma.invoiceAR.findMany({ where: { tenantId }, include: { customer: true } }),
      prisma.invoiceAP.findMany({ where: { tenantId }, include: { supplier: true } }),
      prisma.forecastWeek.findMany({ where: { tenantId, scenario: 'BASE' }, orderBy: { weekNumber: 'asc' } }),
      prisma.bankMovement.findMany({
        where: { bankAccount: { tenantId } },
        orderBy: { date: 'asc' },
        include: { bankAccount: { select: { alias: true } } },
      }),
      prisma.customer.findMany({ where: { tenantId } }),
      prisma.covenant.findMany({ where: { tenantId } }),
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
      tasks: this.generateTasks(invoicesAR, invoicesAP, forecast, customers, covenants),
    }
  }

  private generateTasks(invoicesAR: any[], invoicesAP: any[], forecast: any[], customers: any[], covenants: any[]) {
    const tasks: { type: 'critical' | 'warning' | 'info'; task: string; impact: string; positive: boolean; page: string }[] = []
    const now = Date.now()
    const dayMs = 86400000

    // 1. Overdue AR invoices — group by customer, pick the most impactful
    const overdueAR = invoicesAR.filter(i => i.status !== 'PAID' && new Date(i.dueDate).getTime() < now)
    if (overdueAR.length > 0) {
      // Group by customer and find the one with highest outstanding
      const byCustomer: Record<string, { name: string; total: number; maxDays: number }> = {}
      for (const inv of overdueAR) {
        const cName = inv.customer?.name || 'Desconocido'
        const cId = inv.customerId
        const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount)
        const daysOverdue = Math.ceil((now - new Date(inv.dueDate).getTime()) / dayMs)
        if (!byCustomer[cId]) byCustomer[cId] = { name: cName, total: 0, maxDays: 0 }
        byCustomer[cId].total += outstanding
        byCustomer[cId].maxDays = Math.max(byCustomer[cId].maxDays, daysOverdue)
      }
      const sorted = Object.values(byCustomer).sort((a, b) => b.total - a.total)
      for (const c of sorted.slice(0, 2)) {
        tasks.push({
          type: 'critical',
          task: `Cobrar ${c.name} (${c.maxDays}d vencida)`,
          impact: `+${Math.round(c.total).toLocaleString('es-ES')} €`,
          positive: true,
          page: '/dashboard/scoring',
        })
      }
    }

    // 2. Forecast gaps — earliest gap week
    const gapWeeks = forecast.filter(w => w.isGap)
    if (gapWeeks.length > 0) {
      const firstGap = gapWeeks[0]
      const deficit = Math.abs(Number(firstGap.netCash))
      tasks.push({
        type: 'warning',
        task: `Revisar gap Semana ${firstGap.weekNumber} — mitigación urgente`,
        impact: `+${Math.round(deficit).toLocaleString('es-ES')} €`,
        positive: true,
        page: '/dashboard/forecast',
      })
    }

    // 3. AP invoices pending approval — biggest ones
    const pendingAP = invoicesAP.filter(i => i.status === 'IN_REVIEW' || i.status === 'PENDING_APPROVAL')
    if (pendingAP.length > 0) {
      const sorted = pendingAP.sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
      const top = sorted[0]
      const amount = Number(top.totalAmount)
      const supplierName = top.supplier?.name || top.number
      if (pendingAP.length === 1) {
        tasks.push({
          type: 'warning',
          task: `Aprobar pago ${supplierName} (${top.number})`,
          impact: `−${Math.round(amount).toLocaleString('es-ES')} €`,
          positive: false,
          page: '/dashboard/pagos',
        })
      } else {
        tasks.push({
          type: 'warning',
          task: `Aprobar ${pendingAP.length} pagos pendientes (mayor: ${supplierName})`,
          impact: `−${Math.round(pendingAP.reduce((s, i) => s + Number(i.totalAmount), 0)).toLocaleString('es-ES')} €`,
          positive: false,
          page: '/dashboard/pagos',
        })
      }
    }

    // 4. Covenants at risk (margin < 15%)
    const atRisk = covenants.filter(c => Number(c.margin) < 15 && c.status === 'COMPLIANT')
    for (const cov of atRisk.slice(0, 1)) {
      tasks.push({
        type: 'warning',
        task: `Covenant ${cov.name} con margen bajo (${Number(cov.margin)}%)`,
        impact: `Límite: ${cov.limitValue}`,
        positive: false,
        page: '/dashboard/deuda',
      })
    }

    // 5. Alert customers — suggest credit review
    const alertCustomers = customers.filter(c => c.status === 'ALERT')
    if (alertCustomers.length > 0) {
      const totalExposure = overdueAR
        .filter(i => alertCustomers.some(c => c.id === i.customerId))
        .reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
      if (totalExposure > 0) {
        tasks.push({
          type: 'critical',
          task: `Revisar crédito de ${alertCustomers.length} cliente${alertCustomers.length > 1 ? 's' : ''} en alerta`,
          impact: `${Math.round(totalExposure).toLocaleString('es-ES')} € en riesgo`,
          positive: false,
          page: '/dashboard/scoring',
        })
      }
    }

    // 6. AP invoices due this week
    const dueThisWeek = invoicesAP.filter(i => {
      if (i.status === 'PAID' || i.status === 'REJECTED') return false
      const d = new Date(i.dueDate).getTime()
      return d >= now && d < now + 7 * dayMs
    })
    if (dueThisWeek.length > 0) {
      const total = dueThisWeek.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
      tasks.push({
        type: 'info',
        task: `${dueThisWeek.length} pago${dueThisWeek.length > 1 ? 's' : ''} vence${dueThisWeek.length > 1 ? 'n' : ''} esta semana`,
        impact: `−${Math.round(total).toLocaleString('es-ES')} €`,
        positive: false,
        page: '/dashboard/pagos',
      })
    }

    // Sort: critical first, then warning, then info. Max 6 tasks.
    const order = { critical: 0, warning: 1, info: 2 }
    return tasks.sort((a, b) => order[a.type] - order[b.type]).slice(0, 6)
  }

  async getAutoMatches(tenantId: string) {
    const [movements, invoicesAR, invoicesAP] = await Promise.all([
      prisma.bankMovement.findMany({
        where: { bankAccount: { tenantId }, reconciled: false },
        include: { bankAccount: { select: { alias: true, bankName: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.invoiceAR.findMany({ where: { tenantId, status: { not: 'PAID' } }, include: { customer: true } }),
      prisma.invoiceAP.findMany({ where: { tenantId, status: { not: 'PAID' } }, include: { supplier: true } }),
    ])

    type Match = {
      movementId: string
      movement: { id: string; date: any; concept: string; amount: number; counterparty: string | null; reference: string | null; account: string }
      invoiceId: string
      invoiceType: 'AR' | 'AP'
      invoiceNumber: string
      counterparty: string
      invoiceAmount: number
      confidence: number
      matchReasons: string[]
    }

    const matches: Match[] = []
    const usedMovements = new Set<string>()
    const usedInvoices = new Set<string>()

    for (const mov of movements) {
      if (usedMovements.has(mov.id)) continue
      const amount = Number(mov.amount)
      const absAmount = Math.abs(amount)
      const ref = (mov.reference || '').toUpperCase()
      const concept = (mov.concept || '').toUpperCase()
      const counterparty = (mov.counterparty || '').toUpperCase()

      // Match positive movements with AR invoices (cobros)
      if (amount > 0) {
        for (const inv of invoicesAR) {
          if (usedInvoices.has(inv.id)) continue
          const pending = Number(inv.totalAmount) - Number(inv.paidAmount)
          const invNum = (inv.number || '').toUpperCase()
          const custName = (inv.customer?.name || '').toUpperCase()

          let confidence = 0
          const reasons: string[] = []

          // Amount match
          if (Math.abs(absAmount - pending) < 0.01) { confidence += 50; reasons.push('Importe exacto') }
          else if (Math.abs(absAmount - pending) / pending < 0.02) { confidence += 30; reasons.push('Importe similar (±2%)') }

          // Reference match
          if (ref && invNum && (ref.includes(invNum) || concept.includes(invNum))) { confidence += 30; reasons.push(`Referencia: ${inv.number}`) }

          // Counterparty match
          if (counterparty && custName && (counterparty.includes(custName.slice(0, 10)) || custName.includes(counterparty.slice(0, 10)))) { confidence += 20; reasons.push(`Contraparte: ${inv.customer?.name}`) }

          if (confidence >= 50) {
            matches.push({
              movementId: mov.id,
              movement: { id: mov.id, date: mov.date, concept: mov.concept, amount, counterparty: mov.counterparty, reference: mov.reference, account: (mov as any).bankAccount?.alias },
              invoiceId: inv.id,
              invoiceType: 'AR',
              invoiceNumber: inv.number,
              counterparty: inv.customer?.name || '',
              invoiceAmount: pending,
              confidence: Math.min(confidence, 100),
              matchReasons: reasons,
            })
            usedMovements.add(mov.id)
            usedInvoices.add(inv.id)
            break
          }
        }
      }

      // Match negative movements with AP invoices (pagos)
      if (amount < 0 && !usedMovements.has(mov.id)) {
        for (const inv of invoicesAP) {
          if (usedInvoices.has(inv.id)) continue
          if (inv.status === 'REJECTED') continue
          const pending = Number(inv.totalAmount) - Number(inv.paidAmount)
          const invNum = (inv.number || '').toUpperCase()
          const suppName = (inv.supplier?.name || '').toUpperCase()

          let confidence = 0
          const reasons: string[] = []

          if (Math.abs(absAmount - pending) < 0.01) { confidence += 50; reasons.push('Importe exacto') }
          else if (Math.abs(absAmount - pending) / pending < 0.02) { confidence += 30; reasons.push('Importe similar (±2%)') }

          if (ref && invNum && (ref.includes(invNum) || concept.includes(invNum))) { confidence += 30; reasons.push(`Referencia: ${inv.number}`) }

          if (counterparty && suppName && (counterparty.includes(suppName.slice(0, 10)) || suppName.includes(counterparty.slice(0, 10)))) { confidence += 20; reasons.push(`Contraparte: ${inv.supplier?.name}`) }

          if (confidence >= 50) {
            matches.push({
              movementId: mov.id,
              movement: { id: mov.id, date: mov.date, concept: mov.concept, amount, counterparty: mov.counterparty, reference: mov.reference, account: (mov as any).bankAccount?.alias },
              invoiceId: inv.id,
              invoiceType: 'AP',
              invoiceNumber: inv.number,
              counterparty: inv.supplier?.name || '',
              invoiceAmount: pending,
              confidence: Math.min(confidence, 100),
              matchReasons: reasons,
            })
            usedMovements.add(mov.id)
            usedInvoices.add(inv.id)
            break
          }
        }
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence)

    return {
      matches,
      unmatched: movements.filter(m => !usedMovements.has(m.id)).length,
      totalPending: movements.length,
    }
  }

  async getFinancialRatios(tenantId: string) {
    const [accounts, invoicesAR, invoicesAP, instruments, covenants, inventory] = await Promise.all([
      prisma.bankAccount.findMany({ where: { tenantId } }),
      prisma.invoiceAR.findMany({ where: { tenantId } }),
      prisma.invoiceAP.findMany({ where: { tenantId } }),
      prisma.debtInstrument.findMany({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.covenant.findMany({ where: { tenantId } }),
      prisma.inventoryItem.findMany({ where: { tenantId } }),
    ])

    const cash = accounts.reduce((s, a) => s + Number(a.balance), 0)
    const totalAR = invoicesAR.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const totalAP = invoicesAP.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const totalDebt = instruments.reduce((s, i) => s + Number(i.outstanding), 0)
    const avgRate = instruments.length ? instruments.reduce((s, i) => s + Number(i.interestRate), 0) / instruments.length : 0
    const inventoryValue = inventory.reduce((s, i) => s + Number(i.totalValue), 0)

    // Derived financials (some hardcoded as in cockpit service, representing P&L data)
    const revenue = 4820000
    const ebitda = 1150000
    const netIncome = 820000
    const depreciation = 180000
    const interestExpense = totalDebt * avgRate
    const taxExpense = 150000

    // Balance sheet components
    const currentAssets = cash + totalAR + inventoryValue
    const totalAssets = currentAssets + 1500000 // fixed assets estimate
    const currentLiabilities = totalAP + (totalDebt * 0.15) // short-term portion
    const totalEquity = totalAssets - totalDebt - currentLiabilities
    const quickAssets = cash + totalAR // exclude inventory

    // Ratios
    const ratios = [
      {
        id: 'current_ratio',
        category: 'liquidity',
        name: 'Ratio Corriente',
        formula: 'Activo Corriente / Pasivo Corriente',
        value: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
        unit: 'x',
        benchmark: { sector: 1.5, min: 1.0, max: 3.0, good: 'above' as const },
        description: 'Capacidad para cubrir deudas a corto plazo con activos líquidos. Por encima de 1.2x se considera saludable.',
        components: { 'Activo Corriente': currentAssets, 'Pasivo Corriente': currentLiabilities },
      },
      {
        id: 'quick_ratio',
        category: 'liquidity',
        name: 'Quick Ratio (Acid Test)',
        formula: '(Caja + AR) / Pasivo Corriente',
        value: currentLiabilities > 0 ? quickAssets / currentLiabilities : 0,
        unit: 'x',
        benchmark: { sector: 1.0, min: 0.7, max: 2.0, good: 'above' as const },
        description: 'Liquidez inmediata sin contar inventario. Más exigente que el ratio corriente.',
        components: { 'Caja': cash, 'Cuentas por Cobrar': totalAR, 'Pasivo Corriente': currentLiabilities },
      },
      {
        id: 'cash_ratio',
        category: 'liquidity',
        name: 'Ratio de Caja',
        formula: 'Caja / Pasivo Corriente',
        value: currentLiabilities > 0 ? cash / currentLiabilities : 0,
        unit: 'x',
        benchmark: { sector: 0.3, min: 0.1, max: 1.0, good: 'above' as const },
        description: 'Capacidad de pago inmediato solo con efectivo disponible.',
        components: { 'Caja': cash, 'Pasivo Corriente': currentLiabilities },
      },
      {
        id: 'debt_equity',
        category: 'solvency',
        name: 'Deuda / Equity',
        formula: 'Deuda Total / Patrimonio Neto',
        value: totalEquity > 0 ? totalDebt / totalEquity : 0,
        unit: 'x',
        benchmark: { sector: 0.8, min: 0, max: 2.0, good: 'below' as const },
        description: 'Proporción de financiación ajena vs propia. Mayor ratio = mayor apalancamiento y riesgo.',
        components: { 'Deuda Total': totalDebt, 'Patrimonio Neto': totalEquity },
      },
      {
        id: 'debt_assets',
        category: 'solvency',
        name: 'Deuda / Activos',
        formula: 'Deuda Total / Activos Totales',
        value: totalAssets > 0 ? totalDebt / totalAssets : 0,
        unit: '%',
        benchmark: { sector: 40, min: 0, max: 70, good: 'below' as const },
        description: 'Porcentaje de activos financiados con deuda. Por debajo del 50% es conservador.',
        components: { 'Deuda Total': totalDebt, 'Activos Totales': totalAssets },
      },
      {
        id: 'interest_coverage',
        category: 'solvency',
        name: 'Cobertura de Intereses',
        formula: 'EBITDA / Gastos Financieros',
        value: interestExpense > 0 ? ebitda / interestExpense : 99,
        unit: 'x',
        benchmark: { sector: 5.0, min: 2.0, max: 15.0, good: 'above' as const },
        description: 'Veces que el EBITDA cubre los gastos financieros. Por debajo de 3x es señal de estrés.',
        components: { 'EBITDA': ebitda, 'Gastos Financieros': interestExpense },
      },
      {
        id: 'roe',
        category: 'profitability',
        name: 'ROE',
        formula: 'Beneficio Neto / Patrimonio Neto',
        value: totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0,
        unit: '%',
        benchmark: { sector: 15, min: 5, max: 30, good: 'above' as const },
        description: 'Return on Equity. Rentabilidad del capital invertido por los accionistas.',
        components: { 'Beneficio Neto': netIncome, 'Patrimonio Neto': totalEquity },
      },
      {
        id: 'roa',
        category: 'profitability',
        name: 'ROA',
        formula: 'Beneficio Neto / Activos Totales',
        value: totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0,
        unit: '%',
        benchmark: { sector: 8, min: 3, max: 20, good: 'above' as const },
        description: 'Return on Assets. Eficiencia en el uso de todos los activos para generar beneficio.',
        components: { 'Beneficio Neto': netIncome, 'Activos Totales': totalAssets },
      },
      {
        id: 'ebitda_margin',
        category: 'profitability',
        name: 'Margen EBITDA',
        formula: 'EBITDA / Revenue',
        value: revenue > 0 ? (ebitda / revenue) * 100 : 0,
        unit: '%',
        benchmark: { sector: 18, min: 10, max: 35, good: 'above' as const },
        description: 'Rentabilidad operativa antes de amortizaciones e impuestos.',
        components: { 'EBITDA': ebitda, 'Revenue': revenue },
      },
      {
        id: 'net_margin',
        category: 'profitability',
        name: 'Margen Neto',
        formula: 'Beneficio Neto / Revenue',
        value: revenue > 0 ? (netIncome / revenue) * 100 : 0,
        unit: '%',
        benchmark: { sector: 10, min: 3, max: 25, good: 'above' as const },
        description: 'Porcentaje de beneficio final sobre ingresos después de todos los gastos.',
        components: { 'Beneficio Neto': netIncome, 'Revenue': revenue },
      },
      {
        id: 'asset_turnover',
        category: 'efficiency',
        name: 'Rotación de Activos',
        formula: 'Revenue / Activos Totales',
        value: totalAssets > 0 ? revenue / totalAssets : 0,
        unit: 'x',
        benchmark: { sector: 1.2, min: 0.5, max: 2.5, good: 'above' as const },
        description: 'Eficiencia en el uso de activos para generar ingresos. Mayor = más eficiente.',
        components: { 'Revenue': revenue, 'Activos Totales': totalAssets },
      },
      {
        id: 'working_capital',
        category: 'efficiency',
        name: 'Capital Circulante Neto',
        formula: 'Activo Corriente − Pasivo Corriente',
        value: currentAssets - currentLiabilities,
        unit: '€',
        benchmark: { sector: 500000, min: 0, max: 2000000, good: 'above' as const },
        description: 'Recursos de corto plazo disponibles tras cubrir obligaciones inmediatas.',
        components: { 'Activo Corriente': currentAssets, 'Pasivo Corriente': currentLiabilities },
      },
    ]

    // Historical evolution (simulated quarterly trend)
    const history = [
      { period: 'Q2 2025', current_ratio: 1.55, quick_ratio: 0.85, debt_equity: 1.1, roe: 11.2, roa: 5.8, ebitda_margin: 20.5, interest_coverage: 5.8 },
      { period: 'Q3 2025', current_ratio: 1.62, quick_ratio: 0.92, debt_equity: 1.0, roe: 12.8, roa: 6.5, ebitda_margin: 21.2, interest_coverage: 6.5 },
      { period: 'Q4 2025', current_ratio: 1.70, quick_ratio: 0.98, debt_equity: 0.92, roe: 14.1, roa: 7.2, ebitda_margin: 22.4, interest_coverage: 7.2 },
      { period: 'Q1 2026', current_ratio: ratios[0].value, quick_ratio: ratios[1].value, debt_equity: ratios[3].value, roe: ratios[6].value, roa: ratios[7].value, ebitda_margin: ratios[8].value, interest_coverage: ratios[5].value },
    ]

    return { ratios, history }
  }

  async getCashFlowStatement(tenantId: string, from?: string, to?: string) {
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to + 'T23:59:59')
    const movements = await prisma.bankMovement.findMany({
      where: { bankAccount: { tenantId }, ...(from || to ? { date: dateFilter } : {}) },
      orderBy: { date: 'asc' },
      include: { bankAccount: { select: { alias: true } } },
    })

    // Classify categories into operating/investing/financing
    const operatingCats = ['COBRO', 'PAGO_PROV', 'NOMINA', 'SS', 'IMPUESTO', 'SUMINISTRO', 'ALQUILER', 'SEGURO', 'COMISION', 'DEVOLUCION', 'MANT']
    const investingCats = ['LEASING']
    const financingCats = ['TRANSFER']

    function classify(cat: string | null) {
      if (!cat) return 'operating'
      if (investingCats.includes(cat)) return 'investing'
      if (financingCats.includes(cat)) return 'financing'
      return 'operating'
    }

    // Group by month
    const monthlyMap = new Map<string, { operating: number; investing: number; financing: number; details: Record<string, number> }>()
    for (const m of movements) {
      const month = new Date(m.date).toISOString().slice(0, 7)
      if (!monthlyMap.has(month)) monthlyMap.set(month, { operating: 0, investing: 0, financing: 0, details: {} })
      const entry = monthlyMap.get(month)!
      const amount = Number(m.amount)
      const type = classify(m.category)
      entry[type] += amount
      const cat = m.category || 'OTHER'
      entry.details[cat] = (entry.details[cat] || 0) + amount
    }

    const months = [...monthlyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }))

    // Category breakdown for current period
    const categoryBreakdown: Record<string, { amount: number; count: number; type: string }> = {}
    for (const m of movements) {
      const cat = m.category || 'OTHER'
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { amount: 0, count: 0, type: classify(m.category) }
      categoryBreakdown[cat].amount += Number(m.amount)
      categoryBreakdown[cat].count++
    }

    // Totals
    const totalOperating = movements.filter(m => classify(m.category) === 'operating').reduce((s, m) => s + Number(m.amount), 0)
    const totalInvesting = movements.filter(m => classify(m.category) === 'investing').reduce((s, m) => s + Number(m.amount), 0)
    const totalFinancing = movements.filter(m => classify(m.category) === 'financing').reduce((s, m) => s + Number(m.amount), 0)
    const netCashFlow = totalOperating + totalInvesting + totalFinancing

    // Recent movements for detail view
    const recentMovements = movements.slice(-30).reverse().map(m => ({
      id: m.id,
      date: m.date,
      concept: m.concept,
      amount: Number(m.amount),
      category: m.category,
      counterparty: m.counterparty,
      account: m.bankAccount.alias,
      flowType: classify(m.category),
      reconciled: m.reconciled,
    }))

    return {
      months,
      categoryBreakdown,
      totals: { operating: totalOperating, investing: totalInvesting, financing: totalFinancing, net: netCashFlow },
      recentMovements,
      movementCount: movements.length,
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

  async getInvoicesAR(tenantId: string, from?: string, to?: string) {
    const where: any = { tenantId }
    if (from || to) {
      where.issueDate = {}
      if (from) where.issueDate.gte = new Date(from)
      if (to) where.issueDate.lte = new Date(to + 'T23:59:59')
    }
    return prisma.invoiceAR.findMany({ where, include: { customer: true }, orderBy: { dueDate: 'asc' } })
  }

  async getInvoicesAP(tenantId: string, from?: string, to?: string) {
    const where: any = { tenantId }
    if (from || to) {
      where.issueDate = {}
      if (from) where.issueDate.gte = new Date(from)
      if (to) where.issueDate.lte = new Date(to + 'T23:59:59')
    }
    return prisma.invoiceAP.findMany({ where, include: { supplier: true }, orderBy: { dueDate: 'asc' } })
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

  async rejectInvoiceAP(id: string, userId: string, reason?: string) {
    const invoice = await prisma.invoiceAP.findFirst({ where: { id } })
    if (!invoice) throw new Error('Invoice not found')
    return prisma.invoiceAP.update({
      where: { id },
      data: { status: 'REJECTED', notes: reason ? `[RECHAZADA] ${reason}` : '[RECHAZADA] Marcada como duplicado o fraudulenta' },
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
