'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonDeuda } from '@/components/ui/skeleton-page'

const DEBT_LABELS: Record<string, string> = {
  SYNDICATED_LOAN: 'Préstamo Sindicado',
  CREDIT_LINE: 'Línea de Crédito',
  LEASING: 'Leasing',
  BOND: 'Bono',
  FACTORING: 'Factoring',
  OTHER: 'Otro',
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--destructive))',
  'hsl(210, 60%, 55%)',
  'hsl(280, 50%, 55%)',
]

export default function DeudaPage() {
  const [data, setData] = useState<any>(null)
  const [amort, setAmort] = useState<any>(null)

  useEffect(() => {
    api.debt.summary().then(setData).catch(console.error)
    api.debt.amortization().then(setAmort).catch(console.error)
  }, [])

  if (!data) return <SkeletonDeuda />

  const instruments = data?.instruments || []
  const covenants = data?.covenants || []

  return (
    <div className="space-y-6">
      <div><h1 className="page-title">Deuda & Covenants</h1><p className="page-subtitle">Instrumentos de financiación y cumplimiento bancario · Marzo 2026</p></div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deuda Total', value: fmtEur(data?.totalDebt || 0) },
          { label: 'Deuda Neta', value: fmtEur(data?.netDebt || 0) },
          { label: 'Coste Medio', value: `${fmt((data?.avgRate || 0) * 100, 2)}%`, color: 'text-warning' },
          { label: 'Covenants OK', value: `${covenants.filter((c: any) => c.status === 'COMPLIANT').length}/${covenants.length}`, color: 'text-success' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color || 'text-foreground'}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Amortization Chart + Maturity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Calendario de Amortización</CardTitle></CardHeader>
          <CardContent>
            {amort?.schedule ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={amort.schedule.filter((_: any, i: number) => i % 2 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      const inst = amort.instruments?.find((i: any) => i.id === name)
                      const label = inst ? `${DEBT_LABELS[inst.type] || inst.type} (${inst.bank})` : name
                      return [fmtEur(value), label]
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const inst = amort.instruments?.find((i: any) => i.id === value)
                      return inst ? `${DEBT_LABELS[inst.type] || inst.type}` : value
                    }}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  {amort.instruments?.map((inst: any, idx: number) => (
                    <Bar key={inst.id} dataKey={inst.id} stackId="amort" fill={COLORS[idx % COLORS.length]} radius={idx === amort.instruments.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Timeline de Vencimientos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(amort?.instruments || []).map((inst: any, idx: number) => {
              const matDate = new Date(inst.maturityDate)
              const now = new Date()
              const totalSpan = matDate.getTime() - now.getTime()
              const totalMonths = inst.monthsRemaining
              const isUrgent = totalMonths <= 6
              const isWarning = totalMonths <= 12 && !isUrgent
              const pctElapsed = inst.totalAmount > 0 ? Math.round(((inst.totalAmount - inst.outstanding) / inst.totalAmount) * 100) : 0

              return (
                <div key={inst.id} className="bg-muted rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-sm">{DEBT_LABELS[inst.type] || inst.type}</div>
                      <div className="text-xs text-muted-foreground">{inst.bank}</div>
                    </div>
                    <Badge variant={isUrgent ? 'destructive' : isWarning ? 'warning' : 'secondary'}>
                      {isUrgent ? <AlertTriangle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
                      {totalMonths} meses
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Saldo vivo</span>
                      <div className="font-mono font-semibold">{fmtEur(inst.outstanding)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo</span>
                      <div className="font-mono font-semibold text-warning">{fmt(inst.interestRate * 100, 2)}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vencimiento</span>
                      <div className="font-mono font-semibold">{matDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                  {/* Progress bar: amortized portion */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Amortizado: {pctElapsed}%</span>
                      <span>{fmtEur(inst.totalAmount - inst.outstanding)} / {fmtEur(inst.totalAmount)}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pctElapsed}%`,
                          backgroundColor: COLORS[idx % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            {!amort?.instruments?.length && (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instruments Table + Covenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Instrumentos de Deuda</CardTitle></CardHeader>
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{['Instrumento','Entidad','Saldo Vivo','Tipo','Vencimiento'].map(h => <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {instruments.map((d: any) => (
                  <tr key={d.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3 font-medium">{DEBT_LABELS[d.type] || d.type}</td>
                    <td className="p-3 text-xs text-muted-foreground">{d.bank}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(d.outstanding))}</td>
                    <td className="p-3 font-mono text-xs text-warning">{fmt(Number(d.interestRate) * 100, 2)}%</td>
                    <td className="p-3 font-mono text-xs">{String(d.maturityDate).slice(0,7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
</ScrollableTable>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estado Covenants</CardTitle>
            {data?.allCompliant && <Badge variant="success"><CheckCircle2 size={12} className="mr-1" />Todos OK</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            {covenants.map((cv: any) => (
              <div key={cv.name} className="bg-muted rounded-lg p-3 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold">{cv.name}</span>
                  <Badge variant={cv.status === 'COMPLIANT' ? 'success' : cv.status === 'WARNING' ? 'warning' : 'destructive'}>
                    {cv.status === 'COMPLIANT' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                    {cv.status === 'COMPLIANT' ? 'OK' : cv.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Actual: <strong className="text-foreground">{typeof cv.currentValue === 'number' && cv.currentValue > 1000 ? fmtEur(cv.currentValue) : `${Number(cv.currentValue)}x`}</strong></span>
                  <span>Límite: {typeof cv.limitValue === 'number' && cv.limitValue > 1000 ? fmtEur(cv.limitValue) : `${Number(cv.limitValue)}x`}</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(90, 100 - Number(cv.margin))}%` }} />
                </div>
                <div className="text-xs text-success mt-1.5 font-medium">Margen disponible: +{Number(cv.margin)}%</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
