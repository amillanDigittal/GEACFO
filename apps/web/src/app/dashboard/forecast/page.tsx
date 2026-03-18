'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmt, fmtEur, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/kpi-card'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Landmark, AlertTriangle, TrendingDown, Target, Download, Siren } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonForecast } from '@/components/ui/skeleton-page'

export default function ForecastPage() {
  const [single, setSingle] = useState<any>(null)
  const [compare, setCompare] = useState<any>(null)
  const [scenario, setScenario] = useState('BASE')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'single' | 'compare'>('compare')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.treasury.forecast(scenario),
      api.treasury.forecastCompare(),
    ])
      .then(([s, c]) => { setSingle(s); setCompare(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [scenario])

  const singleData = single?.weeks?.map((w: any) => ({
    week: `S${w.weekNumber}`,
    cobros: Number(w.inflows),
    pagos: Number(w.outflows),
    neto: Number(w.inflows) - Number(w.outflows),
    saldo: Number(w.cumBalance),
    isGap: w.isGap,
    confidence: Number(w.confidence),
  })) || []

  const compareData = compare?.weeks?.map((w: any) => ({
    week: `S${w.weekNumber}`,
    saldoBase: w.base?.cumBalance || null,
    saldoConservador: w.conservador?.cumBalance || null,
    saldoAgresivo: w.agresivo?.cumBalance || null,
    cobrosBase: w.base?.inflows || null,
    cobrosConservador: w.conservador?.inflows || null,
    cobrosAgresivo: w.agresivo?.inflows || null,
    pagosBase: w.base?.outflows || null,
    pagosConservador: w.conservador?.outflows || null,
    pagosAgresivo: w.agresivo?.outflows || null,
    confBase: w.base?.confidence || null,
    confConservador: w.conservador?.confidence || null,
    confAgresivo: w.agresivo?.confidence || null,
    isGap: w.base?.isGap || w.conservador?.isGap || w.agresivo?.isGap,
  })) || []

  // KPIs from comparison data
  const baseWeeks = compare?.weeks?.filter((w: any) => w.base) || []
  const gapWeeks = baseWeeks.filter((w: any) => w.base?.isGap)
  const minBalance = baseWeeks.length > 0 ? Math.min(...baseWeeks.map((w: any) => w.base.cumBalance)) : 0
  const endBalance = baseWeeks.length > 0 ? baseWeeks[baseWeeks.length - 1].base.cumBalance : 0
  const avgConfidence = baseWeeks.length > 0 ? Math.round(baseWeeks.reduce((s: number, w: any) => s + w.base.confidence, 0) / baseWeeks.length) : 0

  const kpis = [
    { label: 'Saldo Final S13', value: fmtEur(endBalance), icon: <Landmark size={20} />, sub: 'Escenario Base', trend: endBalance > (compare?.initialCash || 0) ? '+' + fmt(endBalance - (compare?.initialCash || 0)) : fmt(endBalance - (compare?.initialCash || 0)), up: endBalance >= (compare?.initialCash || 0) },
    { label: 'Gaps Detectados', value: `${gapWeeks.length}`, icon: <AlertTriangle size={20} />, sub: `de ${baseWeeks.length} semanas`, trend: gapWeeks.length === 0 ? 'Sin riesgo' : `${gapWeeks.length} semana${gapWeeks.length > 1 ? 's' : ''}`, up: gapWeeks.length === 0 },
    { label: 'Saldo Mínimo', value: fmtEur(minBalance), icon: <TrendingDown size={20} />, sub: 'Punto más bajo en horizonte', trend: minBalance > 0 ? 'Positivo' : 'Negativo', up: minBalance > 0 },
    { label: 'Confianza Media', value: `${avgConfidence}%`, icon: <Target size={20} />, sub: 'Fiabilidad de previsión', trend: avgConfidence >= 80 ? 'Alta' : avgConfidence >= 60 ? 'Media' : 'Baja', up: avgConfidence >= 70 },
  ]

  if (loading) return <SkeletonForecast />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Forecast 13 Semanas</h1>
          <p className="page-subtitle">Horizonte de gestión de liquidez · 05/03/2026 – 04/06/2026</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(
            `forecast_comparativa`,
            ['Semana', 'Saldo Base', 'Saldo Conservador', 'Saldo Agresivo', 'Cobros Base', 'Pagos Base', 'Confianza Base'],
            compareData.map((w: any) => [w.week, w.saldoBase, w.saldoConservador, w.saldoAgresivo, w.cobrosBase, w.pagosBase, w.confBase])
          )}><Download size={14} className="mr-1" />Exportar</Button>
        </div>
      </div>

      {/* Alert for gaps */}
      {gapWeeks.length > 0 && (
        <div className="flex gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">GAP CRÍTICO — {gapWeeks.length} semana{gapWeeks.length > 1 ? 's' : ''} con déficit</div>
            <div className="text-xs opacity-80 mt-0.5">
              {gapWeeks.map((w: any) => `S${w.weekNumber}`).join(', ')} — Los pagos superan los cobros en el escenario base
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button onClick={() => setTab('compare')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'compare' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Comparativa 3 Escenarios
        </button>
        <button onClick={() => setTab('single')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'single' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Detalle por Escenario
        </button>
      </div>

      {tab === 'compare' ? (
        <>
          {/* Comparison: Saldo Acumulado */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>Saldo Acumulado — 3 Escenarios</CardTitle>
                <div className="flex gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30">Base</Badge>
                  <Badge className="bg-warning/20 text-warning border-warning/30">Conservador</Badge>
                  <Badge className="bg-success/20 text-success border-success/30">Agresivo</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConservador" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAgresivo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(Number(v)), name]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="saldoAgresivo" name="Agresivo" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gradAgresivo)" strokeDasharray="5 3" />
                  <Area type="monotone" dataKey="saldoBase" name="Base" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradBase)" />
                  <Area type="monotone" dataKey="saldoConservador" name="Conservador" stroke="hsl(var(--warning))" strokeWidth={2} fill="url(#gradConservador)" strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparison: Cobros vs Pagos grouped */}
          <Card>
            <CardHeader><CardTitle>Cobros vs Pagos por Escenario</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(Number(v)), name]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="cobrosBase" name="Cobros Base" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[2,2,0,0]} />
                  <Bar dataKey="pagosBase" name="Pagos Base" fill="hsl(var(--destructive))" fillOpacity={0.6} radius={[2,2,0,0]} />
                  <Bar dataKey="cobrosConservador" name="Cobros Conserv." fill="hsl(var(--warning))" fillOpacity={0.6} radius={[2,2,0,0]} />
                  <Bar dataKey="cobrosAgresivo" name="Cobros Agresivo" fill="hsl(var(--success))" fillOpacity={0.6} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence chart */}
          <Card>
            <CardHeader><CardTitle>Nivel de Confianza por Semana</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [`${v}%`, name]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                  <ReferenceLine y={70} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: 'Umbral 70%', fill: 'hsl(var(--warning))', fontSize: 10 }} />
                  <Line type="monotone" dataKey="confBase" name="Base" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="confConservador" name="Conservador" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="confAgresivo" name="Agresivo" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparison table */}
          <Card>
            <CardHeader><CardTitle>Tabla Comparativa de Saldos</CardTitle></CardHeader>
            <ScrollableTable>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Sem.</th>
                    <th className="text-right p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]" colSpan={2}>Base</th>
                    <th className="text-right p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]" colSpan={2}>Conservador</th>
                    <th className="text-right p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]" colSpan={2}>Agresivo</th>
                    <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Δ Max</th>
                  </tr>
                  <tr className="border-b border-border bg-muted/30">
                    <th></th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">Neto</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">Saldo</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">Neto</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">Saldo</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">Neto</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">Saldo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {compareData.map((w: any) => {
                    const netoBase = (w.cobrosBase || 0) - (w.pagosBase || 0)
                    const netoConserv = (w.cobrosConservador || 0) - (w.pagosConservador || 0)
                    const netoAgresivo = (w.cobrosAgresivo || 0) - (w.pagosAgresivo || 0)
                    const saldos = [w.saldoBase, w.saldoConservador, w.saldoAgresivo].filter(Boolean)
                    const delta = saldos.length >= 2 ? Math.max(...saldos) - Math.min(...saldos) : 0
                    return (
                      <tr key={w.week} className={`border-b border-border hover:bg-muted/50 ${w.isGap ? 'bg-destructive/5' : ''}`}>
                        <td className="p-2.5 font-mono font-bold" style={{ color: w.isGap ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}><span className="flex items-center gap-1">{w.week}{w.isGap && <AlertTriangle size={12} />}</span></td>
                        <td className={`p-2.5 font-mono text-right ${netoBase < 0 ? 'text-destructive' : 'text-success'}`}>{netoBase > 0 ? '+' : ''}{fmt(netoBase)}</td>
                        <td className="p-2.5 font-mono text-right text-primary font-semibold">{fmt(w.saldoBase || 0)}</td>
                        <td className={`p-2.5 font-mono text-right ${netoConserv < 0 ? 'text-destructive' : 'text-success'}`}>{netoConserv > 0 ? '+' : ''}{fmt(netoConserv)}</td>
                        <td className="p-2.5 font-mono text-right text-warning font-semibold">{fmt(w.saldoConservador || 0)}</td>
                        <td className={`p-2.5 font-mono text-right ${netoAgresivo < 0 ? 'text-destructive' : 'text-success'}`}>{netoAgresivo > 0 ? '+' : ''}{fmt(netoAgresivo)}</td>
                        <td className="p-2.5 font-mono text-right text-success font-semibold">{fmt(w.saldoAgresivo || 0)}</td>
                        <td className="p-2.5 font-mono text-center text-muted-foreground">{fmt(delta)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
</ScrollableTable>
          </Card>
        </>
      ) : (
        <>
          {/* Single scenario view */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Escenario:</span>
            <select value={scenario} onChange={e => setScenario(e.target.value)} className="text-sm bg-card border border-border rounded-md px-3 py-1.5 text-foreground">
              <option value="BASE">Base</option>
              <option value="CONSERVADOR">Conservador (−15%)</option>
              <option value="AGRESIVO">Agresivo (+15%)</option>
            </select>
          </div>

          <Card>
            <CardHeader><CardTitle>Cobros vs Pagos — {scenario}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={singleData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip formatter={(v: any) => fmtEur(v)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="cobros" name="Cobros" fill="hsl(var(--success))" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pagos" name="Pagos" fill="hsl(var(--destructive))" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Saldo Acumulado — {scenario}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={singleData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="singleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => [fmtEur(Number(v)), 'Saldo']} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#singleGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Single scenario actions + table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Acciones de Mitigación</CardTitle><Badge variant="warning">3 opciones</Badge></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Activar línea CaixaBank 100.000 €', impact: '+100.000 €', days: 'Disponible en 1 día' },
                  { label: 'Anticipar cobro Industrias Químicas F-0312', impact: '+48.500 €', days: 'Negociar 15d descuento' },
                  { label: 'Aplazar pago Logística Express 30d', impact: '+18.900 €', days: 'Acordar extensión' },
                ].map(a => (
                  <div key={a.label} className="flex items-center justify-between bg-muted rounded-lg p-3 border border-border">
                    <div><div className="text-sm text-foreground">{a.label}</div><div className="text-xs text-muted-foreground mt-0.5">{a.days}</div></div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-success">{a.impact}</span>
                      <Button variant="ghost" size="sm">Activar</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Posición Semanal — {scenario}</CardTitle></CardHeader>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">{['Sem.', 'Cobros', 'Pagos', 'Neto', 'Saldo', 'Conf.'].map(h => <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">{h}</th>)}</tr></thead>
                  <tbody>
                    {singleData.map((w: any) => (
                      <tr key={w.week} className={`border-b border-border hover:bg-muted/50 ${w.isGap ? 'bg-destructive/5' : ''}`}>
                        <td className="p-2.5 font-mono font-bold" style={{ color: w.isGap ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}><span className="flex items-center gap-1">{w.week}{w.isGap && <AlertTriangle size={12} />}</span></td>
                        <td className="p-2.5 font-mono text-success">{fmt(w.cobros)}</td>
                        <td className="p-2.5 font-mono text-destructive">{fmt(w.pagos)}</td>
                        <td className="p-2.5 font-mono font-semibold" style={{ color: w.neto < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))' }}>{w.neto > 0 ? '+' : ''}{fmt(w.neto)}</td>
                        <td className="p-2.5 font-mono text-primary">{fmt(w.saldo)}</td>
                        <td className="p-2.5 font-mono text-muted-foreground">{w.confidence}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
