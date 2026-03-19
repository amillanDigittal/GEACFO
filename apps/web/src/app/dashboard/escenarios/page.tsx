'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmt, fmtEur, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Download, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Siren } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonEscenarios } from '@/components/ui/skeleton-page'
import { PageHeader } from '@/components/page-header'

const scenarioMeta: Record<string, { label: string; color: string; desc: string }> = {
  BASE: { label: 'Base', color: 'hsl(var(--primary))', desc: 'Proyección con supuestos actuales' },
  CONSERVADOR: { label: 'Conservador', color: 'hsl(var(--warning))', desc: 'Cobros −15%, pagos +10%' },
  AGRESIVO: { label: 'Agresivo', color: 'hsl(var(--success))', desc: 'Cobros +15%, pagos −5%' },
}

export default function EscenariosPage() {
  const [scenarios, setScenarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [simResult, setSimResult] = useState<any>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [dso, setDso] = useState(42)
  const [revenueChange, setRevenueChange] = useState(0)
  const [activeTab, setActiveTab] = useState<'comparativa' | 'simulador'>('comparativa')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  function fetchData() {
    setLoading(true)
    return api.scenarios.compare()
      .then(setScenarios)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => { fetchData() }, [])

  async function refresh() {
    await fetchData()
  }

  function runSimulation() {
    setSimLoading(true)
    api.scenarios.simulate({ dso, revenueChange })
      .then(setSimResult)
      .catch(console.error)
      .finally(() => setSimLoading(false))
  }

  if (loading) return <SkeletonEscenarios />

  const base = scenarios.find((s: any) => s.scenario === 'BASE')
  const gapWeeks = base?.weeks?.filter((w: any) => w.isGap) || []

  // Build chart data from BASE scenario weeks
  const chartData = (base?.weeks || []).map((w: any) => {
    const row: any = {
      week: `S${w.weekNumber}`,
      weekNumber: w.weekNumber,
      isGap: w.isGap,
    }
    scenarios.forEach((s: any) => {
      const sw = s.weeks.find((sw: any) => sw.weekNumber === w.weekNumber)
      if (sw) {
        row[`saldo_${s.scenario}`] = Number(sw.cumBalance)
        row[`cobros_${s.scenario}`] = Number(sw.inflows)
        row[`pagos_${s.scenario}`] = Number(sw.outflows)
        row[`neto_${s.scenario}`] = Number(sw.netCash)
        row[`confidence_${s.scenario}`] = Number(sw.confidence)
      }
    })
    return row
  })

  const hasMultipleScenarios = scenarios.filter((s: any) => s.weeks.length > 0).length > 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Supuestos & Escenarios"
        subtitle="Análisis de sensibilidad · 13 semanas · Grupo Ibérico SA"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <div className="flex bg-muted rounded-lg p-0.5">
              {(['comparativa', 'simulador'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'comparativa' ? 'Comparativa' : 'Simulador'}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV('escenarios_comparativa', ['Semana', ...scenarios.map((s: any) => `Cobros_${s.scenario}`), ...scenarios.map((s: any) => `Pagos_${s.scenario}`), ...scenarios.map((s: any) => `Saldo_${s.scenario}`)], chartData.map((row: any) => [row.week, ...scenarios.map((s: any) => row[`cobros_${s.scenario}`] ?? ''), ...scenarios.map((s: any) => row[`pagos_${s.scenario}`] ?? ''), ...scenarios.map((s: any) => row[`saldo_${s.scenario}`] ?? '')]))}><Download size={14} className="mr-1" />Exportar</Button>
          </>
        }
      />

      {/* Alerta de gaps */}
      {gapWeeks.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{gapWeeks.length} semana{gapWeeks.length > 1 ? 's' : ''} con déficit en escenario Base</div>
            <div className="text-xs opacity-80 mt-0.5">
              {gapWeeks.map((w: any) => `S${w.weekNumber} (${fmtEur(Math.abs(Number(w.netCash)) * 1000)})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* KPIs por escenario */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((s: any) => {
          const meta = scenarioMeta[s.scenario]
          const hasData = s.weeks.length > 0
          return (
            <Card key={s.scenario} className={!hasData ? 'opacity-50' : ''}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </div>
                  {!hasData && <Badge variant="secondary">Sin datos</Badge>}
                  {hasData && s.scenario === 'BASE' && <Badge variant="default">Activo</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">{meta.desc}</p>
                {hasData ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Caja Final (S13)</span>
                      <span className="font-mono text-sm font-bold">{fmtEur(s.finalCash * 1000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Total Cobros</span>
                      <span className="font-mono text-xs text-success">{fmtEur(s.totalInflows * 1000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Total Pagos</span>
                      <span className="font-mono text-xs text-destructive">{fmtEur(s.totalOutflows * 1000)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2">
                      <span className="text-xs text-muted-foreground">Cash Flow Neto</span>
                      <span className={`font-mono text-xs font-bold ${s.totalInflows - s.totalOutflows >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {s.totalInflows - s.totalOutflows >= 0 ? '+' : ''}{fmtEur((s.totalInflows - s.totalOutflows) * 1000)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">Configurar supuestos para generar proyección</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {activeTab === 'comparativa' && (
        <>
          {/* Gráfico de saldo acumulado */}
          <Card>
            <CardHeader><CardTitle>Evolución Saldo Acumulado por Escenario</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(Number(v) * 1000), name.replace('saldo_', '')]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Legend formatter={(value: string) => scenarioMeta[value.replace('saldo_', '')]?.label || value} />
                  {scenarios.filter((s: any) => s.weeks.length > 0).map((s: any) => (
                    <Area
                      key={s.scenario}
                      type="monotone"
                      dataKey={`saldo_${s.scenario}`}
                      name={`saldo_${s.scenario}`}
                      stroke={scenarioMeta[s.scenario].color}
                      fill={scenarioMeta[s.scenario].color}
                      fillOpacity={0.1}
                      strokeWidth={s.scenario === 'BASE' ? 2.5 : 1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico cobros vs pagos + tabla */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Cobros vs Pagos — Base</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}k`} />
                    <Tooltip
                      formatter={(v: any) => fmtEur(Number(v) * 1000)}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    />
                    <Legend />
                    <Bar dataKey="cobros_BASE" name="Cobros" fill="hsl(var(--success))" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pagos_BASE" name="Pagos" fill="hsl(var(--destructive))" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Confianza del Modelo</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Confianza']}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="confidence_BASE" name="Confianza" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabla detallada */}
          <Card>
            <CardHeader><CardTitle>Detalle Semanal — Escenario Base</CardTitle></CardHeader>
            <ScrollableTable>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {['Semana', 'Período', 'Cobros', 'Pagos', 'Neto', 'Saldo Acum.', 'Confianza', 'Estado'].map(h => (
                      <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(base?.weeks || []).map((w: any) => {
                    const net = Number(w.netCash)
                    const conf = Number(w.confidence)
                    const weekStart = new Date(w.weekStart)
                    const weekEnd = new Date(w.weekEnd)
                    const fmtDate = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
                    return (
                      <tr key={w.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${w.isGap ? 'bg-destructive/5' : ''}`}>
                        <td className="p-2.5 font-mono font-bold" style={{ color: w.isGap ? 'hsl(var(--destructive))' : 'inherit' }}>
                          <span className="flex items-center gap-1">S{w.weekNumber}{w.isGap && <AlertTriangle size={12} />}</span>
                        </td>
                        <td className="p-2.5 text-muted-foreground">{fmtDate(weekStart)} – {fmtDate(weekEnd)}</td>
                        <td className="p-2.5 font-mono text-success">{fmtEur(Number(w.inflows) * 1000)}</td>
                        <td className="p-2.5 font-mono text-destructive">{fmtEur(Number(w.outflows) * 1000)}</td>
                        <td className="p-2.5 font-mono font-semibold" style={{ color: net < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))' }}>
                          {net > 0 ? '+' : ''}{fmtEur(net * 1000)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-primary">{fmtEur(Number(w.cumBalance) * 1000)}</td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-12">
                              <div className="h-full rounded-full" style={{ width: `${conf}%`, background: conf >= 80 ? 'hsl(var(--success))' : conf >= 70 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} />
                            </div>
                            <span className="font-mono text-[10px]" style={{ color: conf >= 80 ? 'hsl(var(--success))' : conf >= 70 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>{conf.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-2.5">
                          <Badge variant={w.isGap ? 'destructive' : net < 0 ? 'warning' : 'success'}>
                            {w.isGap ? 'Gap' : net < 0 ? 'Déficit' : 'OK'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
</ScrollableTable>
          </Card>
        </>
      )}

      {activeTab === 'simulador' && (
        <>
          {/* Simulador de sensibilidad */}
          <Card>
            <CardHeader>
              <CardTitle>Simulador de Sensibilidad</CardTitle>
              <p className="text-xs text-muted-foreground">Ajusta los parámetros para proyectar el impacto en tesorería</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DSO slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">DSO (Días de cobro)</label>
                    <span className="font-mono text-sm font-bold text-primary">{dso} días</span>
                  </div>
                  <input
                    type="range" min={15} max={90} value={dso}
                    onChange={e => setDso(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>15d (óptimo)</span>
                    <span>42d (actual)</span>
                    <span>90d (riesgo)</span>
                  </div>
                </div>

                {/* Revenue change slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Variación Revenue</label>
                    <span className={`font-mono text-sm font-bold ${revenueChange >= 0 ? 'text-success' : 'text-destructive'}`}>{revenueChange > 0 ? '+' : ''}{revenueChange}%</span>
                  </div>
                  <input
                    type="range" min={-30} max={30} value={revenueChange}
                    onChange={e => setRevenueChange(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>−30% (pesimista)</span>
                    <span>0% (base)</span>
                    <span>+30% (optimista)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button onClick={runSimulation} disabled={simLoading}>
                  {simLoading ? 'Calculando...' : 'Ejecutar Simulación'}
                </Button>
                <Button variant="outline" onClick={() => { setDso(42); setRevenueChange(0); setSimResult(null) }}>
                  Resetear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultados simulación */}
          {simResult && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Caja Proyectada</div>
                <div className={`font-mono text-xl font-bold ${simResult.projectedCash >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  {fmtEur(Math.round(simResult.projectedCash))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Impacto DSO</div>
                <div className={`font-mono text-xl font-bold ${simResult.dsoImpact >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {simResult.dsoImpact >= 0 ? '+' : ''}{fmtEur(Math.round(simResult.dsoImpact))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Impacto Revenue</div>
                <div className={`font-mono text-xl font-bold ${simResult.revenueImpact >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {simResult.revenueImpact >= 0 ? '+' : ''}{fmtEur(Math.round(simResult.revenueImpact))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Riesgo Covenant</div>
                <div className={`font-mono text-xl font-bold ${simResult.covenantRisk ? 'text-destructive' : 'text-success'}`}>
                  {simResult.covenantRisk ? 'EN RIESGO' : 'OK'}
                </div>
              </div>
            </div>
          )}

          {simResult && (
            <Card>
              <CardHeader><CardTitle>Interpretación</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dso !== 42 && (
                    <div className="flex items-start gap-3 text-sm">
                      <span className="flex-shrink-0">{dso < 42 ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />}</span>
                      <div>
                        <span className="font-medium">{dso < 42 ? 'Mejora' : 'Deterioro'} del DSO:</span>
                        <span className="text-muted-foreground"> Pasar de 42 a {dso} días {dso < 42 ? 'libera' : 'consume'} {fmtEur(Math.abs(Math.round(simResult.dsoImpact)))} en circulante.</span>
                      </div>
                    </div>
                  )}
                  {revenueChange !== 0 && (
                    <div className="flex items-start gap-3 text-sm">
                      <span className="flex-shrink-0">{revenueChange > 0 ? <TrendingUp size={16} className="text-success" /> : <TrendingDown size={16} className="text-destructive" />}</span>
                      <div>
                        <span className="font-medium">Revenue {revenueChange > 0 ? '+' : ''}{revenueChange}%:</span>
                        <span className="text-muted-foreground"> Impacto adicional de {fmtEur(Math.abs(Math.round(simResult.revenueImpact)))} sobre la posición de caja.</span>
                      </div>
                    </div>
                  )}
                  {simResult.covenantRisk && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                      <Siren size={16} className="flex-shrink-0" />
                      <div>
                        <span className="font-semibold">Alerta de covenant:</span> Con estos supuestos la caja proyectada cae por debajo de 500.000 €, activando riesgo de incumplimiento.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
