'use client'

import { fmtEur } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Droplets } from 'lucide-react'
import { Delta } from './helpers'

export function LiquiditySection({ liq, pliq, showCompare }: {
  liq: any; pliq: any; showCompare: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span><Droplets size={18} /></span>
            <CardTitle>2. Posición de Liquidez</CardTitle>
            {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Estado actual y proyección de tesorería a 13 semanas</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Caja Actual</div>
              <div className="font-mono text-2xl font-bold">{fmtEur(liq.currentCash)}</div>
              <div className="text-xs text-muted-foreground mt-1">Posición consolidada</div>
              {showCompare && pliq && <div className="mt-1"><Delta current={liq.currentCash} previous={pliq.currentCash} format={fmtEur} /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Caja Proyectada (S13)</div>
              <div className="font-mono text-2xl font-bold text-primary">{fmtEur(liq.forecastedCash * 1000)}</div>
              <div className="text-xs text-muted-foreground mt-1">Fin del horizonte forecast</div>
              {showCompare && pliq && <div className="mt-1"><Delta current={liq.forecastedCash * 1000} previous={pliq.forecastedCash * 1000} format={fmtEur} /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Semanas con Gap</div>
              <div className={`font-mono text-2xl font-bold ${liq.gapWeeks.length > 0 ? 'text-warning' : 'text-success'}`}>{liq.gapWeeks.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {liq.gapWeeks.length > 0 ? `S${liq.gapWeeks.join(', S')}` : 'Sin gaps detectados'}
              </div>
              {showCompare && pliq && <div className="mt-1"><Delta current={liq.gapWeeks.length} previous={pliq.gapWeeks.length} invert /></div>}
            </div>
          </div>

          {showCompare && pliq && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Evolución de Liquidez Q4 → Q1</div>
              <div className="space-y-2">
                {[
                  { label: 'Caja', q4: fmtEur(pliq.currentCash), q1: fmtEur(liq.currentCash), curr: liq.currentCash, prev: pliq.currentCash },
                  { label: 'Forecast S13', q4: fmtEur(pliq.forecastedCash * 1000), q1: fmtEur(liq.forecastedCash * 1000), curr: liq.forecastedCash * 1000, prev: pliq.forecastedCash * 1000 },
                  { label: 'Semanas Gap', q4: String(pliq.gapWeeks.length), q1: String(liq.gapWeeks.length), curr: liq.gapWeeks.length, prev: pliq.gapWeeks.length, invert: true },
                ].map(r => (
                  <div key={r.label} className="flex items-center text-xs py-1.5 border-b border-border last:border-0">
                    <span className="flex-1 text-muted-foreground">{r.label}</span>
                    <span className="w-28 text-right font-mono text-muted-foreground">{r.q4}</span>
                    <span className="w-6 text-center text-muted-foreground">→</span>
                    <span className="w-28 text-right font-mono font-semibold">{r.q1}</span>
                    <span className="w-32 text-right"><Delta current={r.curr} previous={r.prev} invert={r.invert} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liq.gapWeeks.length > 0 && (
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="font-semibold text-sm text-warning mb-2">Semanas con déficit de caja</div>
              <div className="grid grid-cols-3 gap-3">
                {liq.gapWeeks.map((w: number) => (
                  <div key={w} className="bg-card rounded-lg p-3 border border-border text-center">
                    <div className="font-mono text-lg font-bold text-warning">S{w}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Pagos &gt; Cobros</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-3">
                Recomendación: Activar líneas de crédito disponibles o acelerar cobros para cubrir gaps en semanas {liq.gapWeeks.join(', ')}.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
