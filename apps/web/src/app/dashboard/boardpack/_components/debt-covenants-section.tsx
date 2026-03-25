'use client'

import { fmtEur } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Delta } from './helpers'

export function DebtCovenantsSection({ debt, pdebt, es, pes, showCompare }: {
  debt: any; pdebt: any; es: any; pes: any; showCompare: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span><CreditCard size={18} /></span>
              <CardTitle>4. Deuda & Covenants</CardTitle>
              {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
            </div>
            <Badge variant="success">4/4 Cumplidos</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Posición de endeudamiento y cumplimiento de covenants financieros</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Deuda Bruta</div>
              <div className="font-mono text-2xl font-bold">{fmtEur(debt.totalDebt)}</div>
              {showCompare && pdebt && <div className="mt-1"><Delta current={debt.totalDebt} previous={pdebt.totalDebt} format={fmtEur} invert /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Deuda Neta</div>
              <div className="font-mono text-2xl font-bold text-primary">{fmtEur(debt.netDebt)}</div>
              <div className="text-xs text-muted-foreground mt-1">Deuda − Caja</div>
              {showCompare && pdebt && <div className="mt-1"><Delta current={debt.netDebt} previous={pdebt.netDebt} format={fmtEur} invert /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Apalancamiento</div>
              <div className="font-mono text-2xl font-bold text-success">{(debt.netDebt / es.revenue * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Deuda Neta / Revenue</div>
              {showCompare && pdebt && pes && (
                <div className="mt-1"><Delta current={debt.netDebt / es.revenue * 100} previous={pdebt.netDebt / pes.revenue * 100} suffix="pp" invert /></div>
              )}
            </div>
          </div>

          {/* Covenants table */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Covenants Financieros</div>
            <div className="space-y-3">
              {debt.allCovenants.map((cov: any, idx: number) => {
                const margin = Number(cov.margin)
                const prevCov = showCompare && pdebt?.allCovenants?.[idx]
                const prevMargin = prevCov ? Number(prevCov.margin) : null
                const trendIcon = cov.trend === 'IMPROVING' ? <TrendingUp size={14} /> : cov.trend === 'DETERIORATING' ? <TrendingDown size={14} /> : <ArrowRight size={14} />
                const trendLabel = cov.trend === 'IMPROVING' ? 'Mejorando' : cov.trend === 'DETERIORATING' ? 'Deteriorando' : 'Estable'
                return (
                  <div key={cov.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{cov.name}</span>
                        <Badge variant={cov.status === 'COMPLIANT' ? 'success' : 'destructive'}>
                          {cov.status === 'COMPLIANT' ? 'Cumple' : 'Incumple'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{trendIcon} {trendLabel}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{cov.formula}</div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, cov.limitType === 'MAX' ? (Number(cov.currentValue) / Number(cov.limitValue)) * 100 : Math.min(100, (Number(cov.currentValue) / Number(cov.limitValue)) * 50))}%`,
                            background: margin > 30 ? 'hsl(var(--success))' : margin > 10 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-sm font-bold">{cov.currentValue}</div>
                      <div className="text-[10px] text-muted-foreground">{cov.limitType === 'MAX' ? 'Máx' : 'Mín'}: {cov.limitValue}</div>
                      <div className={`font-mono text-xs font-semibold mt-0.5 ${margin > 30 ? 'text-success' : margin > 10 ? 'text-warning' : 'text-destructive'}`}>
                        +{margin}% margen
                      </div>
                      {showCompare && prevMargin !== null && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">Q4: +{prevMargin}%</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
