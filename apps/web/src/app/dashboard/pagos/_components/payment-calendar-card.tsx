'use client'

import { useTranslations } from 'next-intl'
import { fmtEur } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Zap } from 'lucide-react'

interface PaymentCalendarCardProps {
  calendar: { week: string; amount: number; count: number }[]
  totalPending: number
}

export function PaymentCalendarCard({ calendar, totalPending }: PaymentCalendarCardProps) {
  const t = useTranslations('pagos')

  return (
    <Card>
      <CardHeader><CardTitle>{t('calendarTitle')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {calendar.map(w => {
          const pct = totalPending > 0 ? (w.amount / totalPending) * 100 : 0
          const isUrgent = w.week === t('calThisWeek') && w.amount > 0
          return (
            <div key={w.week}>
              <div className="flex justify-between text-xs mb-1">
                <span className={`font-medium ${isUrgent ? 'text-warning' : ''}`}>
                  {w.week} {isUrgent && <Zap size={12} className="inline" />} <span className="text-muted-foreground">({t('calInvCount', { count: w.count })})</span>
                </span>
                <span className={`font-mono font-semibold ${isUrgent ? 'text-warning' : 'text-foreground'}`}>
                  {w.amount > 0 ? fmtEur(w.amount) : '\u2014'}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${pct}%`,
                  background: isUrgent ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
                }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
