'use client'

import { useTranslations } from 'next-intl'
import { fmtEur } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const bankColors: Record<string, string> = {
  BBVA: 'hsl(var(--bank-bbva))',
  Santander: 'hsl(var(--bank-santander))',
  CaixaBank: 'hsl(var(--bank-caixabank))',
  Sabadell: 'hsl(var(--bank-sabadell))',
}

interface BalanceDistributionProps {
  accounts: any[]
  totalBalance: number
}

export function BalanceDistribution({ accounts, totalBalance }: BalanceDistributionProps) {
  const t = useTranslations('conciliacion')

  return (
    <Card>
      <CardHeader><CardTitle>{t('balanceDistribution')}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts
            .sort((a: any, b: any) => Number(b.balance) - Number(a.balance))
            .map((acc: any) => {
              const pct = totalBalance > 0 ? (Number(acc.balance) / totalBalance) * 100 : 0
              const color = bankColors[acc.bankName] || 'hsl(var(--primary))'
              return (
                <div key={acc.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{acc.alias}</span>
                    <span className="text-muted-foreground">{fmtEur(Number(acc.balance))} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
          <span className="text-sm font-semibold">{t('totalConsolidated')}</span>
          <span className="font-mono text-lg font-bold">{fmtEur(totalBalance)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
