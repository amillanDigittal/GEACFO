'use client'

import { useTranslations } from 'next-intl'
import { fmtEur } from '@/lib/utils'
import { compareValues } from '@/components/date-range-selector'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PeriodComparisonProps {
  invoices: any[]
  prevInvoices: any[]
  periodLabel: { current: string; previous: string }
  totalPending: number
}

export function PeriodComparison({ invoices, prevInvoices, periodLabel, totalPending }: PeriodComparisonProps) {
  const t = useTranslations('pagos')

  const prevPending = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const prevTotal = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
  const curTotal = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
  const cmpTotal = compareValues(curTotal, prevTotal)
  const cmpPending = compareValues(totalPending, prevPending)
  const cmpCount = compareValues(invoices.length, prevInvoices.length)

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: t('cmpTotalInvoices'), cur: fmtEur(curTotal), prev: fmtEur(prevTotal), ...cmpTotal },
        { label: t('cmpPendingPayment'), cur: fmtEur(totalPending), prev: fmtEur(prevPending), ...cmpPending },
        { label: t('cmpInvoiceCount'), cur: String(invoices.length), prev: String(prevInvoices.length), ...cmpCount },
      ].map(c => (
        <div key={c.label} className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</div>
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="font-mono text-lg font-bold">{c.cur}</div>
              <div className="text-[10px] text-muted-foreground">vs {c.prev} ({periodLabel.previous})</div>
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${c.positive ? 'text-success' : 'text-destructive'}`}>
              {c.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {c.pct > 0 ? '+' : ''}{c.pct.toFixed(1)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
