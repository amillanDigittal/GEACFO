'use client'

import { useTranslations } from 'next-intl'
import { fmtEur } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const bankColors: Record<string, string> = {
  BBVA: 'hsl(var(--bank-bbva))',
  Santander: 'hsl(var(--bank-santander))',
  CaixaBank: 'hsl(var(--bank-caixabank))',
  Sabadell: 'hsl(var(--bank-sabadell))',
}

interface BankAccountCardsProps {
  accounts: any[]
  totalBalance: number
}

export function BankAccountCards({ accounts, totalBalance }: BankAccountCardsProps) {
  const t = useTranslations('conciliacion')
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {accounts.map((acc: any) => {
        const pct = totalBalance > 0 ? (Number(acc.balance) / totalBalance) * 100 : 0
        const color = bankColors[acc.bankName] || 'hsl(var(--primary))'
        return (
          <Card key={acc.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: color }}>
                    {acc.bankName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{acc.alias}</div>
                    <div className="text-xs text-muted-foreground">{acc.bankName}</div>
                  </div>
                </div>
                <Badge variant="success">{t('badgeActive')}</Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t('labelBalance')}</div>
                  <div className="font-mono text-2xl font-bold">{fmtEur(Number(acc.balance))}</div>
                  <div className="text-xs text-muted-foreground">{t('ofTotal', { pct: pct.toFixed(1) })}</div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">IBAN</div>
                    <div className="font-mono text-[11px] text-foreground">{acc.iban}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">{t('labelCurrency')}</div>
                    <div className="text-xs font-medium">{acc.currency}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    {t('movementsCount', { count: acc.movements?.length || 0 })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {acc.syncedAt ? t('syncDate', { date: fmtDate(acc.syncedAt) }) : t('notSynced')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
