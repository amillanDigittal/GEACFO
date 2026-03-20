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
    const customer = await prisma.customer.findFirst({
      where: { tenantId, id: customerId },
      include: { invoices: true, scoreHistory: { orderBy: { calculatedAt: 'desc' }, take: 5 } },
    })
    if (!customer) throw new Error('Customer not found')

    const invoices = customer.invoices
    const now = new Date()

    // ─── Factor 1: Payment History (40% weight) ─────────────────────
    // Measures: % paid on time, severity of overdue, recent payment behavior
    let paymentHistory = 50 // default if no invoices
    if (invoices.length > 0) {
      const paidInvoices = invoices.filter(i => i.status === 'PAID')
      const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE')
      const totalInvoices = invoices.length

      // Base: % of invoices that are paid (not overdue)
      const paidRatio = totalInvoices > 0 ? ((totalInvoices - overdueInvoices.length) / totalInvoices) : 0.5
      paymentHistory = Math.round(paidRatio * 70) // up to 70 pts from paid ratio

      // Bonus for fully paid invoices
      if (paidInvoices.length > 0) {
        paymentHistory += Math.min(15, Math.round((paidInvoices.length / totalInvoices) * 15))
      }

      // Bonus if no current overdue
      if (overdueInvoices.length === 0) {
        paymentHistory += 15
      } else {
        // Penalty scaled by days overdue
        const maxDaysOverdue = Math.max(...overdueInvoices.map(i =>
          Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000)
        ))
        if (maxDaysOverdue > 90) paymentHistory -= 25
        else if (maxDaysOverdue > 60) paymentHistory -= 15
        else if (maxDaysOverdue > 30) paymentHistory -= 8
      }

      paymentHistory = Math.max(5, Math.min(100, paymentHistory))
    }

    // ─── Factor 2: DSO Trend (25% weight) ───────────────────────────
    // Measures: actual DSO vs target, and trend vs previous calculations
    const pendingInvoices = invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED')
    const totalOutstanding = pendingInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
    const totalRevenue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)

    // Calculate real DSO: (outstanding / total revenue) * days in period
    const oldestInvoice = invoices.length > 0
      ? new Date(Math.min(...invoices.map(i => new Date(i.issueDate).getTime())))
      : new Date(now.getTime() - 90 * 86400000)
    const periodDays = Math.max(30, Math.floor((now.getTime() - oldestInvoice.getTime()) / 86400000))
    const realDSO = totalRevenue > 0 ? Math.round((totalOutstanding / totalRevenue) * periodDays) : 0

    const dsoTarget = 45
    let dsoTrend = 50
    if (realDSO <= dsoTarget * 0.7) dsoTrend = 95          // excellent: DSO well below target
    else if (realDSO <= dsoTarget) dsoTrend = 80            // good: at or below target
    else if (realDSO <= dsoTarget * 1.2) dsoTrend = 60      // acceptable: slightly above
    else if (realDSO <= dsoTarget * 1.5) dsoTrend = 35      // concerning
    else dsoTrend = 15                                       // critical: way above target

    // Adjust for trend: compare to previous score if available
    const prevHistory = customer.scoreHistory
    if (prevHistory.length >= 2) {
      const prevFactors = prevHistory[0].factors as any
      const prevDSO = prevFactors?.dsoTrend || 50
      if (dsoTrend > prevDSO) dsoTrend = Math.min(100, dsoTrend + 5)      // improving
      else if (dsoTrend < prevDSO) dsoTrend = Math.max(5, dsoTrend - 5)   // deteriorating
    }

    // ─── Factor 3: Seniority / Relationship (15% weight) ────────────
    // Measures: age of relationship, volume, consistency
    const customerAgeDays = Math.floor((now.getTime() - new Date(customer.createdAt).getTime()) / 86400000)
    const customerAgeMonths = Math.floor(customerAgeDays / 30)

    let seniority = 30 // base
    if (customerAgeMonths >= 24) seniority = 95       // 2+ years
    else if (customerAgeMonths >= 12) seniority = 80  // 1+ year
    else if (customerAgeMonths >= 6) seniority = 65   // 6+ months
    else if (customerAgeMonths >= 3) seniority = 50   // 3+ months
    else seniority = 30                                // new customer

    // Volume bonus: more invoices = more established relationship
    if (invoices.length >= 10) seniority = Math.min(100, seniority + 10)
    else if (invoices.length >= 5) seniority = Math.min(100, seniority + 5)

    // ─── Factor 4: Financial Capacity (20% weight) ──────────────────
    // Measures: credit utilization, payment amounts vs credit limit, partial payments
    const creditLimit = Number(customer.creditLimit)
    let financialCapacity = 50

    if (creditLimit > 0) {
      const utilization = totalOutstanding / creditLimit
      if (utilization <= 0.3) financialCapacity = 95        // very low utilization
      else if (utilization <= 0.5) financialCapacity = 80   // moderate
      else if (utilization <= 0.7) financialCapacity = 65   // elevated
      else if (utilization <= 0.9) financialCapacity = 40   // high utilization
      else financialCapacity = 15                            // over limit or near
    } else {
      // No credit limit set — base on payment behavior
      financialCapacity = paymentHistory > 70 ? 70 : 40
    }

    // Check for partial payments (indicates capacity issues if frequent)
    const partialPayments = invoices.filter(i => i.status === 'PARTIAL')
    if (partialPayments.length > 2) financialCapacity = Math.max(10, financialCapacity - 15)

    // ─── Composite Score ─────────────────────────────────────────────
    const score = Math.max(5, Math.min(100, Math.round(
      paymentHistory * 0.40 +
      dsoTrend * 0.25 +
      seniority * 0.15 +
      financialCapacity * 0.20
    )))

    const riskLevel = score >= 85 ? 'VERY_LOW'
      : score >= 70 ? 'LOW'
      : score >= 55 ? 'MEDIUM'
      : score >= 35 ? 'HIGH'
      : 'CRITICAL'

    const status = riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'ALERT' : 'ACTIVE'

    const factors = {
      paymentHistory,
      dsoTrend,
      seniority,
      financialCapacity,
      // Extra detail for UI
      _detail: {
        totalInvoices: invoices.length,
        overdueCount: invoices.filter(i => i.status === 'OVERDUE').length,
        paidCount: invoices.filter(i => i.status === 'PAID').length,
        realDSO,
        dsoTarget,
        customerAgeMonths,
        creditUtilization: creditLimit > 0 ? Math.round((totalOutstanding / creditLimit) * 100) : null,
        totalOutstanding: Math.round(totalOutstanding),
      },
    }

    await prisma.scoreHistory.create({
      data: { customerId, score, riskLevel: riskLevel as any, factors },
    })

    return prisma.customer.update({
      where: { id: customerId },
      data: { creditScore: score, riskLevel: riskLevel as any, dso: realDSO, status: status as any },
    })
  }
}
