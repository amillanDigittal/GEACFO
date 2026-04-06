'use client'

import { useTranslations } from 'next-intl'
import { fmtEur } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface BySupplierCardProps {
  bySupplier: Record<string, { name: string; code: string; terms: number; total: number; count: number }>
  totalPending: number
}

export function BySupplierCard({ bySupplier, totalPending }: BySupplierCardProps) {
  const t = useTranslations('pagos')

  return (
    <Card>
      <CardHeader><CardTitle>{t('bySupplierTitle')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {Object.values(bySupplier)
          .sort((a, b) => b.total - a.total)
          .map(s => {
            const pct = totalPending > 0 ? (s.total / totalPending) * 100 : 0
            return (
              <div key={s.code} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    <Badge variant="secondary">{s.code}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{t('supplierInvoices', { count: s.count })} · {t('supplierTerms', { days: s.terms })}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-xs font-semibold">{fmtEur(s.total)}</div>
                  <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                </div>
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}
