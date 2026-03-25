'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'
import { Delta } from './helpers'

export function WorkingCapitalSection({ wc, pwc, showCompare }: {
  wc: any; pwc: any; showCompare: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span><RefreshCw size={18} /></span>
            <CardTitle>3. Working Capital</CardTitle>
            {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Ciclo de conversión de efectivo y métricas de capital circulante</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'DSO', value: `${wc.dso}d`, target: `Obj: ${wc.dsoTarget}d`, good: wc.dso <= wc.dsoTarget, curr: wc.dso, prev: pwc?.dso, invert: true },
              { label: 'DPO', value: `${wc.dpo}d`, target: 'Días pago medio', good: true, curr: wc.dpo, prev: pwc?.dpo },
              { label: 'CCC', value: `${wc.ccc}d`, target: 'DSO − DPO + DIO', good: wc.ccc < 45, curr: wc.ccc, prev: pwc?.ccc, invert: true },
              { label: 'DSO vs Objetivo', value: wc.dso <= wc.dsoTarget ? 'Cumple' : `+${wc.dso - wc.dsoTarget}d`, target: `${wc.dsoTarget}d objetivo`, good: wc.dso <= wc.dsoTarget },
            ].map(m => (
              <div key={m.label} className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
                <div className={`font-mono text-xl font-bold ${m.good ? 'text-success' : 'text-warning'}`}>{m.value}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{m.target}</div>
                {showCompare && m.prev !== undefined && m.curr !== undefined && (
                  <div className="mt-1"><Delta current={m.curr} previous={m.prev} suffix="d" invert={m.invert} /></div>
                )}
              </div>
            ))}
          </div>

          {/* CCC Visual */}
          <div className="p-5 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Ciclo de Conversión de Efectivo</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                <div className="text-[10px] text-muted-foreground">DSO (Cobro)</div>
                <div className="font-mono text-lg font-bold text-primary">{wc.dso}d</div>
                {showCompare && pwc && <div className="text-[10px] text-muted-foreground">Q4: {pwc.dso}d</div>}
              </div>
              <span className="text-muted-foreground text-lg">−</span>
              <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'hsl(var(--success) / 0.1)' }}>
                <div className="text-[10px] text-muted-foreground">DPO (Pago)</div>
                <div className="font-mono text-lg font-bold text-success">{wc.dpo}d</div>
                {showCompare && pwc && <div className="text-[10px] text-muted-foreground">Q4: {pwc.dpo}d</div>}
              </div>
              <span className="text-muted-foreground text-lg">=</span>
              <div className="flex-1 rounded-lg p-3 text-center border-2 border-primary">
                <div className="text-[10px] text-muted-foreground">CCC</div>
                <div className="font-mono text-lg font-bold">{wc.ccc}d</div>
                {showCompare && pwc && <div className="text-[10px] text-muted-foreground">Q4: {pwc.ccc}d</div>}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-3 text-center">
              {wc.ccc < 0 ? 'CCC negativo: la empresa cobra antes de pagar — posición favorable.' : `${wc.ccc} días de financiación de circulante necesarios.`}
              {showCompare && pwc && ` (Q4: ${pwc.ccc}d → Q1: ${wc.ccc}d, mejora de ${pwc.ccc - wc.ccc}d)`}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
