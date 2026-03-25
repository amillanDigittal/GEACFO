'use client'

import { fmtEur, fmtM } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Delta } from './helpers'

export function ExecutiveSummary({ es, pes, showCompare }: {
  es: any; pes: any; showCompare: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span><BarChart3 size={18} /></span>
            <CardTitle>1. Resumen Ejecutivo</CardTitle>
            {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Visión general de la situación financiera para el Consejo de Administración</p>
        </CardHeader>
        <CardContent>
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${es.alerts > 0 ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/30'}`}>
            <span className="flex-shrink-0">{es.alerts > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}</span>
            <div>
              <div className={`font-semibold text-sm ${es.alerts > 0 ? 'text-warning' : 'text-success'}`}>
                {es.alerts > 0 ? `${es.alerts} alerta${es.alerts > 1 ? 's' : ''} activa${es.alerts > 1 ? 's' : ''} — atención requerida` : 'Situación financiera estable — sin alertas críticas'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Covenants: {es.covenants ? 'Todos cumplidos' : 'Incumplimiento detectado'} · EBITDA Margen: {es.ebitdaMargin}%
              </div>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Posición de Caja</div>
              <div className="font-mono text-xl font-bold">{fmtEur(es.cash)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">4 cuentas bancarias</div>
              {showCompare && pes && <div className="mt-1"><Delta current={es.cash} previous={pes.cash} format={fmtEur} /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Revenue YTD</div>
              <div className="font-mono text-xl font-bold">{fmtM(es.revenue)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">Q1 2026</div>
              {showCompare && pes && <div className="mt-1"><Delta current={es.revenue} previous={pes.revenue} format={fmtM} /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Margen EBITDA</div>
              <div className="font-mono text-xl font-bold">{es.ebitdaMargin}%</div>
              <div className="text-[10px] text-muted-foreground mt-1">Operativo</div>
              {showCompare && pes && <div className="mt-1"><Delta current={es.ebitdaMargin} previous={pes.ebitdaMargin} suffix="pp" /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Covenants</div>
              <div className={`font-mono text-xl font-bold ${es.covenants ? 'text-success' : 'text-destructive'}`}>{es.covenants ? '4/4 OK' : 'Incumplimiento'}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{es.covenants ? 'Todos cumplidos' : 'Revisar deuda'}</div>
              {showCompare && pes && <div className="text-[10px] text-muted-foreground mt-1">Q4: {pes.covenants ? '4/4 OK' : 'Incumplimiento'}</div>}
            </div>
          </div>

          {/* Comparison summary table */}
          {showCompare && pes && (
            <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumen Comparativo Q4 2025 → Q1 2026</div>
              <div className="space-y-2">
                {[
                  { label: 'Posición de Caja', q4: fmtEur(pes.cash), q1: fmtEur(es.cash), curr: es.cash, prev: pes.cash },
                  { label: 'Revenue', q4: fmtM(pes.revenue), q1: fmtM(es.revenue), curr: es.revenue, prev: pes.revenue },
                  { label: 'Margen EBITDA', q4: `${pes.ebitdaMargin}%`, q1: `${es.ebitdaMargin}%`, curr: es.ebitdaMargin, prev: pes.ebitdaMargin },
                  { label: 'Alertas Activas', q4: String(pes.alerts), q1: String(es.alerts), curr: es.alerts, prev: pes.alerts, invert: true },
                ].map(r => (
                  <div key={r.label} className="flex items-center text-xs py-1.5 border-b border-border last:border-0">
                    <span className="flex-1 text-muted-foreground">{r.label}</span>
                    <span className="w-24 text-right font-mono text-muted-foreground">{r.q4}</span>
                    <span className="w-6 text-center text-muted-foreground">→</span>
                    <span className="w-24 text-right font-mono font-semibold">{r.q1}</span>
                    <span className="w-32 text-right"><Delta current={r.curr} previous={r.prev} invert={r.invert} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
