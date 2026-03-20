import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const AGING_BUCKETS = ['CURRENT', 'DAYS_1_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90P'] as const
type AgingBucket = typeof AGING_BUCKETS[number]

const BUCKET_LABELS: Record<AgingBucket, string> = {
  CURRENT: 'Al corriente',
  DAYS_1_30: '1-30 días',
  DAYS_31_60: '31-60 días',
  DAYS_61_90: '61-90 días',
  DAYS_90P: '+90 días',
}

const ECL_RATES: Record<AgingBucket, Record<string, number>> = {
  CURRENT:    { VERY_LOW: 0.005, LOW: 0.005, MEDIUM: 0.01,  HIGH: 0.02,  CRITICAL: 0.05  },
  DAYS_1_30:  { VERY_LOW: 0.01,  LOW: 0.01,  MEDIUM: 0.025, HIGH: 0.05,  CRITICAL: 0.10  },
  DAYS_31_60: { VERY_LOW: 0.02,  LOW: 0.02,  MEDIUM: 0.05,  HIGH: 0.10,  CRITICAL: 0.20  },
  DAYS_61_90: { VERY_LOW: 0.05,  LOW: 0.05,  MEDIUM: 0.10,  HIGH: 0.20,  CRITICAL: 0.35  },
  DAYS_90P:   { VERY_LOW: 0.10,  LOW: 0.10,  MEDIUM: 0.25,  HIGH: 0.50,  CRITICAL: 0.75  },
}

const RISK_LEVELS = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

function classifyBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'CURRENT'
  if (daysOverdue <= 30) return 'DAYS_1_30'
  if (daysOverdue <= 60) return 'DAYS_31_60'
  if (daysOverdue <= 90) return 'DAYS_61_90'
  return 'DAYS_90P'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

@Injectable()
export class ProvisionsService {
  async calculateMatrix(tenantId: string) {
    const invoices = await prisma.invoiceAR.findMany({
      where: { tenantId, status: { notIn: ['PAID', 'CANCELLED'] } },
      include: { customer: true },
    })

    const now = new Date()

    // Initialize matrix
    const matrix: Record<string, Record<string, { exposure: number; provision: number; lossRate: number }>> = {}
    for (const bucket of AGING_BUCKETS) {
      matrix[bucket] = {}
      for (const risk of RISK_LEVELS) {
        matrix[bucket][risk] = { exposure: 0, provision: 0, lossRate: ECL_RATES[bucket][risk] }
      }
    }

    // Per-customer detail
    const customerMap: Record<string, {
      customerId: string; name: string; code: string; riskLevel: string; creditScore: number | null;
      totalExposure: number; totalProvision: number;
      buckets: Record<string, { exposure: number; provision: number }>;
    }> = {}

    for (const inv of invoices) {
      const outstanding = round2(Number(inv.totalAmount) - Number(inv.paidAmount))
      if (outstanding <= 0) continue

      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      const bucket = classifyBucket(daysOverdue)
      const risk = inv.customer.riskLevel || 'MEDIUM'
      const lossRate = ECL_RATES[bucket][risk] || 0.01
      const provision = round2(outstanding * lossRate)

      // Aggregate to matrix
      matrix[bucket][risk].exposure = round2(matrix[bucket][risk].exposure + outstanding)
      matrix[bucket][risk].provision = round2(matrix[bucket][risk].provision + provision)

      // Aggregate to customer detail
      if (!customerMap[inv.customerId]) {
        customerMap[inv.customerId] = {
          customerId: inv.customerId,
          name: inv.customer.name,
          code: inv.customer.code,
          riskLevel: risk,
          creditScore: inv.customer.creditScore,
          totalExposure: 0,
          totalProvision: 0,
          buckets: {},
        }
        for (const b of AGING_BUCKETS) {
          customerMap[inv.customerId].buckets[b] = { exposure: 0, provision: 0 }
        }
      }
      const cd = customerMap[inv.customerId]
      cd.totalExposure = round2(cd.totalExposure + outstanding)
      cd.totalProvision = round2(cd.totalProvision + provision)
      cd.buckets[bucket].exposure = round2(cd.buckets[bucket].exposure + outstanding)
      cd.buckets[bucket].provision = round2(cd.buckets[bucket].provision + provision)
    }

    const details = Object.values(customerMap).sort((a, b) => b.totalProvision - a.totalProvision)
    const totalExposure = round2(details.reduce((s, d) => s + d.totalExposure, 0))
    const totalProvision = round2(details.reduce((s, d) => s + d.totalProvision, 0))
    const coverageRate = totalExposure > 0 ? round2((totalProvision / totalExposure) * 100) : 0

    // Bucket totals for chart
    const bucketSummary = AGING_BUCKETS.map(b => {
      let exposure = 0, provision = 0
      for (const r of RISK_LEVELS) {
        exposure += matrix[b][r].exposure
        provision += matrix[b][r].provision
      }
      return { bucket: b, label: BUCKET_LABELS[b], exposure: round2(exposure), provision: round2(provision) }
    })

    // Risk totals
    const riskSummary = RISK_LEVELS.map(r => {
      let exposure = 0, provision = 0
      for (const b of AGING_BUCKETS) {
        exposure += matrix[b][r].exposure
        provision += matrix[b][r].provision
      }
      return { risk: r, exposure: round2(exposure), provision: round2(provision) }
    })

    const customersAtRisk = details.filter(d => d.riskLevel === 'HIGH' || d.riskLevel === 'CRITICAL').length

    return {
      totalExposure,
      totalProvision,
      coverageRate,
      customersAtRisk,
      customerCount: details.length,
      matrix,
      bucketLabels: BUCKET_LABELS,
      bucketSummary,
      riskSummary,
      details,
    }
  }

  async createSnapshot(tenantId: string, userId?: string) {
    const result = await this.calculateMatrix(tenantId)
    return prisma.provisionSnapshot.create({
      data: {
        tenantId,
        snapshotDate: new Date(),
        totalExposure: result.totalExposure,
        totalProvision: result.totalProvision,
        coverageRate: result.coverageRate / 100,
        matrix: result.matrix as any,
        details: result.details as any,
        createdBy: userId,
      },
    })
  }

  async getSnapshots(tenantId: string) {
    return prisma.provisionSnapshot.findMany({
      where: { tenantId },
      orderBy: { snapshotDate: 'desc' },
      take: 24,
      select: {
        id: true,
        snapshotDate: true,
        totalExposure: true,
        totalProvision: true,
        coverageRate: true,
        createdAt: true,
      },
    })
  }

  async getSnapshot(tenantId: string, id: string) {
    return prisma.provisionSnapshot.findFirst({ where: { tenantId, id } })
  }
}
