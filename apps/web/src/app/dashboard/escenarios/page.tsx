'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmt, fmtEur, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillTabs } from '@/components/ui/pill-tabs'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Download, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Siren } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonEscenarios } from '@/components/ui/skeleton-page'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { useTranslations } from 'next-intl'

export default function EscenariosPage() {
  const t = useTranslations('escenarios')
  const [scenarios, setScenarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [simResult, setSimResult] = useState<any>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [dso, setDso] = useState(42)
  const [revenueChange, setRevenueChange] = useState(0)
  const [activeTab, setActiveTab] = useState<'comparativa' | 'simulador'>('comparativa')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const scenarioMeta: Record<string, { label: string; color: string; desc: string }> = {
    BASE: { label: t('scenarioBase'), color: 'hsl(var(--primary))', desc: t('scenarioBaseDesc') },
    CONSERVADOR: { label: t('scenarioConservative'), color: 'hsl(var(--warning))', desc: t('scenarioConservativeDesc') },
    AGRESIVO: { label: t('scenarioAggressive'), color: 'hsl(var(--success))', desc: t('scenarioAggressiveDesc') },
  }

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

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonEscenarios />

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
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <PillTabs
              tabs={[
                { key: 'comparativa', label: t('tabComparison') },
                { key: 'simulador', label: t('tabSimulator') },
              ]}
              active={activeTab}
              onChange={(k) => setActiveTab(k as any)}
              size="xs"
            />
            <Button variant="outline" size="sm" onClick={() => exportCSV('escenarios_comparativa', [t('colWeek'), ...scenarios.map((s: any) => `${t('colCollections')}_${s.scenario}`), ...scenarios.map((s: any) => `${t('colPayments')}_${s.scenario}`), ...scenarios.map((s: any) => `${t('colBalance')}_${s.scenario}`)], chartData.map((row: any) => [row.week, ...scenarios.map((s: any) => row[`cobros_${s.scenario}`] ?? ''), ...scenarios.map((s: any) => row[`pagos_${s.scenario}`] ?? ''), ...scenarios.map((s: any) => row[`saldo_${s.scenario}`] ?? '')]))}><Download size={14} className="mr-1" />{t('export')}</Button>
          </>
        }
      />

      {/* Alerta de gaps */}
      {gapWeeks.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('gapAlert', { count: gapWeeks.length })}</div>
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
                  {!hasData && <Badge variant="secondary">{t('noData')}</Badge>}
                  {hasData && s.scenario === 'BASE' && <Badge variant="default">{t('active')}</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">{meta.desc}</p>
                {hasData ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t('finalCash')}</span>
                      <span className="font-mono text-sm font-bold">{fmtEur(s.finalCash * 1000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t('totalCollections')}</span>
                      <span className="font-mono text-xs text-success">{fmtEur(s.totalInflows * 1000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{t('totalPayments')}</span>
                      <span className="font-mono text-xs text-destructive">{fmtEur(s.totalOutflows * 1000)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2">
                      <span className="text-xs text-muted-foreground">{t('netCashFlow')}</span>
                      <span className={`font-mono text-xs font-bold ${s.totalInflows - s.totalOutflows >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {s.totalInflows - s.totalOutflows >= 0 ? '+' : ''}{fmtEur((s.totalInflows - s.totalOutflows) * 1000)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">{t('configureToGenerate')}</div>
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
            <CardHeader><CardTitle>{t('cumulativeBalanceChart')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(Number(v) * 1000), name.replace('saldo_', '')]}
                       
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
              <CardHeader><CardTitle>{t('collectionsVsPaymentsBase')}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}k`} />
                    <Tooltip
                      formatter={(v: any) => fmtEur(Number(v) * 1000)}
                       
                    />
                    <Legend />
                    <Bar dataKey="cobros_BASE" name={t('colCollections')} fill="hsl(var(--success))" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pagos_BASE" name={t('colPayments')} fill="hsl(var(--destructive))" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('modelConfidence')}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(v: any) => [`${Number(v).toFixed(1)}%`, t('confidence')]}
                       
                    />
                    <Line type="monotone" dataKey="confidence_BASE" name={t('confidence')} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabla detallada */}
          <Card>
            <CardHeader><CardTitle>{t('weeklyDetailBase')}</CardTitle></CardHeader>
            <ScrollableTable>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {[t('colWeek'), t('colPeriod'), t('colCollections'), t('colPayments'), t('colNet'), t('colCumBalance'), t('colConfidence'), t('colStatus')].map(h => (
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
                            {w.isGap ? t('statusGap') : net < 0 ? t('statusDeficit') : t('statusOk')}
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
              <CardTitle>{t('simulatorTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('simulatorDescription')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DSO slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dsoLabel')}</label>
                    <span className="font-mono text-sm font-bold text-primary">{t('dsoDays', { days: dso })}</span>
                  </div>
                  <input
                    type="range" min={15} max={90} value={dso}
                    onChange={e => setDso(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{t('dsoOptimal')}</span>
                    <span>{t('dsoCurrent')}</span>
                    <span>{t('dsoRisk')}</span>
                  </div>
                </div>

                {/* Revenue change slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('revenueVariation')}</label>
                    <span className={`font-mono text-sm font-bold ${revenueChange >= 0 ? 'text-success' : 'text-destructive'}`}>{revenueChange > 0 ? '+' : ''}{revenueChange}%</span>
                  </div>
                  <input
                    type="range" min={-30} max={30} value={revenueChange}
                    onChange={e => setRevenueChange(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{t('revPessimistic')}</span>
                    <span>{t('revBase')}</span>
                    <span>{t('revOptimistic')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button onClick={runSimulation} disabled={simLoading}>
                  {simLoading ? t('calculating') : t('runSimulation')}
                </Button>
                <Button variant="outline" onClick={() => { setDso(42); setRevenueChange(0); setSimResult(null) }}>
                  {t('reset')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultados simulación */}
          {simResult && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiBox index={0} label={t('projectedCash')} value={fmtEur(Math.round(simResult.projectedCash))} color={simResult.projectedCash >= 0 ? 'text-foreground' : 'text-destructive'} />
              <KpiBox index={1} label={t('dsoImpact')} value={`${simResult.dsoImpact >= 0 ? '+' : ''}${fmtEur(Math.round(simResult.dsoImpact))}`} color={simResult.dsoImpact >= 0 ? 'text-success' : 'text-destructive'} />
              <KpiBox index={2} label={t('revenueImpact')} value={`${simResult.revenueImpact >= 0 ? '+' : ''}${fmtEur(Math.round(simResult.revenueImpact))}`} color={simResult.revenueImpact >= 0 ? 'text-success' : 'text-destructive'} />
              <KpiBox index={3} label={t('covenantRisk')} value={simResult.covenantRisk ? t('atRisk') : t('ok')} color={simResult.covenantRisk ? 'text-destructive' : 'text-success'} />
            </div>
          )}

          {simResult && (
            <Card>
              <CardHeader><CardTitle>{t('interpretation')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dso !== 42 && (
                    <div className="flex items-start gap-3 text-sm">
                      <span className="flex-shrink-0">{dso < 42 ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />}</span>
                      <div>
                        <span className="font-medium">{dso < 42 ? t('dsoImprovement') : t('dsoDeteriorationLabel')}:</span>
                        <span className="text-muted-foreground"> {t('dsoInterpretation', { from: 42, to: dso, action: dso < 42 ? t('releases') : t('consumes'), amount: fmtEur(Math.abs(Math.round(simResult.dsoImpact))) })}</span>
                      </div>
                    </div>
                  )}
                  {revenueChange !== 0 && (
                    <div className="flex items-start gap-3 text-sm">
                      <span className="flex-shrink-0">{revenueChange > 0 ? <TrendingUp size={16} className="text-success" /> : <TrendingDown size={16} className="text-destructive" />}</span>
                      <div>
                        <span className="font-medium">Revenue {revenueChange > 0 ? '+' : ''}{revenueChange}%:</span>
                        <span className="text-muted-foreground"> {t('revenueInterpretation', { amount: fmtEur(Math.abs(Math.round(simResult.revenueImpact))) })}</span>
                      </div>
                    </div>
                  )}
                  {simResult.covenantRisk && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                      <Siren size={16} className="flex-shrink-0" />
                      <div>
                        <span className="font-semibold">{t('covenantAlertLabel')}:</span> {t('covenantAlertMessage')}
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
