'use client'
import { Fragment, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, scoreColor, riskLabel, riskVariant } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Siren, ChevronDown, ChevronUp } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { PageHeader } from '@/components/page-header'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function ScoringPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => { api.customers.list().then(setCustomers).catch(console.error).finally(() => { setLoading(false); setLastUpdated(new Date()) }) }, [])

  async function refresh() {
    try {
      const result = await api.customers.list()
      setCustomers(result)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  async function recalculate(id: string) {
    setRecalculating(prev => new Set(prev).add(id))
    try {
      await api.customers.recalculate(id)
      const updated = await api.customers.list()
      setCustomers(updated)
    } catch (e) { console.error(e) }
    finally { setRecalculating(prev => { const next = new Set(prev); next.delete(id); return next }) }
  }

  async function toggleHistory(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setHistoryLoading(true)
    try {
      const detail = await api.customers.get(id)
      setHistoryData(detail)
    } catch (e) { console.error(e) }
    finally { setHistoryLoading(false) }
  }

  if (loading) return <SkeletonKPIsAndTable cols={8} rows={6} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scoring de Clientes"
        subtitle="Modelo ML de riesgo crediticio · Actualizado 05/03/2026"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <div className="flex gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
        <Siren size={18} className="mt-0.5 flex-shrink-0" />
        <div><div className="font-semibold text-sm">Alerta Activa — Consultores Estratégicos (Score 55)</div>
        <div className="text-xs opacity-80 mt-0.5">DSO 62 días · Exposición 124.000 € · Factura vencida · Gestión urgente requerida</div></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Exposición Total', value: fmtEur(964850) },
          { label: 'Score Medio', value: '75.0', color: 'text-success' },
          { label: 'Alto Riesgo', value: '1', color: 'text-destructive' },
          { label: 'DSO Medio', value: '45.6 d' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color || 'text-foreground'}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Cartera de Clientes — Riesgo Crediticio</CardTitle></CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Cliente','Score IA','Riesgo','Exposición','DSO','Límite','Estado','Acción'].map(h => <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {customers.slice(page * 10, (page + 1) * 10).map(c => {
                const isExpanded = expandedId === c.id
                const scoreColorVal = c.creditScore >= 80 ? 'hsl(var(--success))' : c.creditScore >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
                return (
                <Fragment key={c.id}>
                <tr className={`border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/50' : ''}`} onClick={() => toggleHistory(c.id)}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.code}</div></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16"><div className="h-full rounded-full transition-all" style={{ width: `${c.creditScore}%`, background: scoreColorVal }} /></div>
                      <span className="font-mono text-xs font-bold" style={{ color: scoreColorVal }}>{c.creditScore}</span>
                    </div>
                  </td>
                  <td className="p-3"><Badge variant={riskVariant(c.riskLevel)}>{riskLabel(c.riskLevel)}</Badge></td>
                  <td className="p-3 font-mono text-xs">{fmtEur(c.invoices?.reduce((s: number, i: any) => s + Number(i.totalAmount), 0) || 0)}</td>
                  <td className="p-3 font-mono text-xs" style={{ color: c.dso > 60 ? 'hsl(var(--destructive))' : c.dso > 45 ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>{c.dso}d</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(Number(c.creditLimit))}</td>
                  <td className="p-3"><Badge variant={c.status === 'ALERT' ? 'destructive' : 'success'}>{c.status === 'ALERT' ? 'Alerta' : 'Activo'}</Badge></td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); recalculate(c.id) }} disabled={recalculating.has(c.id)}>
                      <RefreshCw size={13} className={`mr-1 ${recalculating.has(c.id) ? 'animate-spin' : ''}`} />
                      {recalculating.has(c.id) ? 'Calculando…' : 'Recalcular'}
                    </Button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border">
                    <td colSpan={8} className="p-0">
                      <div className="bg-muted/30 p-5">
                        {historyLoading ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">Cargando historial...</div>
                        ) : historyData?.scoreHistory?.length > 0 ? (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Evolución del Score — {historyData.name}</div>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={historyData.scoreHistory.map((h: any) => ({
                                  date: new Date(h.calculatedAt).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
                                  score: h.score,
                                  riskLevel: h.riskLevel,
                                }))}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                                  <ReferenceLine y={80} stroke="hsl(var(--success))" strokeDasharray="3 3" label={{ value: 'Bajo riesgo', position: 'right', fontSize: 9, fill: 'hsl(var(--success))' }} />
                                  <ReferenceLine y={60} stroke="hsl(var(--warning))" strokeDasharray="3 3" label={{ value: 'Medio', position: 'right', fontSize: 9, fill: 'hsl(var(--warning))' }} />
                                  <Tooltip
                                    formatter={(v: any) => [`${v} pts`, 'Score']}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                  />
                                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Factores (último cálculo)</div>
                              {(() => {
                                const last = historyData.scoreHistory[historyData.scoreHistory.length - 1]
                                const factors = last?.factors || {}
                                const labels: Record<string, string> = { paymentHistory: 'Historial de Pago', dsoTrend: 'Tendencia DSO', seniority: 'Antigüedad', financialCapacity: 'Capacidad Financiera' }
                                return (
                                  <div className="space-y-3">
                                    {Object.entries(labels).map(([key, label]) => {
                                      const val = factors[key] || 0
                                      return (
                                        <div key={key}>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-mono font-semibold" style={{ color: val >= 75 ? 'hsl(var(--success))' : val >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>{val}</span>
                                          </div>
                                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: val >= 75 ? 'hsl(var(--success))' : val >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} />
                                          </div>
                                        </div>
                                      )
                                    })}
                                    <div className="pt-2 mt-2 border-t border-border">
                                      <div className="text-[10px] text-muted-foreground">
                                        {historyData.scoreHistory.length} registros · Desde {new Date(historyData.scoreHistory[0].calculatedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-sm text-muted-foreground">Sin historial de scoring. Pulsa &quot;Recalcular&quot; para generar el primer registro.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
</ScrollableTable>
        {customers.length > 10 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button>
            {Array.from({ length: Math.ceil(customers.length / 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= Math.ceil(customers.length / 10) - 1} onClick={() => setPage(p => p + 1)}>→</Button>
            <span className="text-xs text-muted-foreground ml-2">{page * 10 + 1}–{Math.min((page + 1) * 10, customers.length)} de {customers.length}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
