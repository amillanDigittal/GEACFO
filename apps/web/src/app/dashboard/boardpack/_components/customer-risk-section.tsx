'use client'

import { fmtEur, riskLabel } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Siren } from 'lucide-react'
import { Delta } from './helpers'

export function CustomerRiskSection({ cr, pcr, showCompare }: {
  cr: any; pcr: any; showCompare: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span><AlertTriangle size={18} /></span>
            <CardTitle>5. Riesgo de Clientes</CardTitle>
            {showCompare && <Badge variant="secondary">Q4→Q1</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Exposición crediticia y clientes en alerta</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Exposición Total</div>
              <div className="font-mono text-2xl font-bold">{fmtEur(cr.totalExposure)}</div>
              <div className="text-xs text-muted-foreground mt-1">Cuentas por cobrar</div>
              {showCompare && pcr && <div className="mt-1"><Delta current={cr.totalExposure} previous={pcr.totalExposure} format={fmtEur} invert /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Score Medio</div>
              <div className={`font-mono text-2xl font-bold ${cr.avgScore >= 70 ? 'text-success' : cr.avgScore >= 50 ? 'text-warning' : 'text-destructive'}`}>{cr.avgScore}</div>
              <div className="text-xs text-muted-foreground mt-1">Modelo ML crediticio</div>
              {showCompare && pcr && <div className="mt-1"><Delta current={cr.avgScore} previous={pcr.avgScore} /></div>}
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Clientes en Alerta</div>
              <div className={`font-mono text-2xl font-bold ${cr.alertCustomers.length > 0 ? 'text-destructive' : 'text-success'}`}>{cr.alertCustomers.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Gestión urgente</div>
              {showCompare && pcr && <div className="mt-1"><Delta current={cr.alertCustomers.length} previous={pcr.alertCustomers.length} invert /></div>}
            </div>
          </div>

          {showCompare && pcr && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Variación Riesgo Q4 → Q1</div>
              <div className="space-y-2">
                {[
                  { label: 'Exposición Total', q4: fmtEur(pcr.totalExposure), q1: fmtEur(cr.totalExposure), curr: cr.totalExposure, prev: pcr.totalExposure, invert: true },
                  { label: 'Score Medio', q4: String(pcr.avgScore), q1: String(cr.avgScore), curr: cr.avgScore, prev: pcr.avgScore },
                  { label: 'Clientes en Alerta', q4: String(pcr.alertCustomers.length), q1: String(cr.alertCustomers.length), curr: cr.alertCustomers.length, prev: pcr.alertCustomers.length, invert: true },
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

          {cr.alertCustomers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Clientes en Alerta</div>
              {cr.alertCustomers.map((c: any) => (
                <div key={c.id} className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Siren size={18} />
                      <span className="font-semibold">{c.name}</span>
                      <Badge variant="secondary">{c.code}</Badge>
                      <Badge variant="destructive">{riskLabel(c.riskLevel)}</Badge>
                    </div>
                    <Badge variant={c.status === 'ALERT' ? 'destructive' : 'success'}>
                      {c.status === 'ALERT' ? 'Alerta Activa' : 'Activo'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">Score IA</div>
                      <div className="font-mono text-lg font-bold text-destructive">{c.creditScore}</div>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">DSO</div>
                      <div className="font-mono text-lg font-bold text-destructive">{c.dso}d</div>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">Límite Crédito</div>
                      <div className="font-mono text-lg font-bold">{fmtEur(Number(c.creditLimit))}</div>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">Riesgo</div>
                      <div className="font-mono text-lg font-bold text-destructive">{riskLabel(c.riskLevel)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Recomendación: Suspender nuevos pedidos, iniciar proceso de gestión de cobro activa y revisar provisión por insolvencia.
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
