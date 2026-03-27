'use client'
import { useState, useCallback } from 'react'
import { useForecast, useForecastCompare } from '@/hooks/use-api'
import { useHydrated } from '@/hooks/use-hydrated'
import { fmt, fmtEur, exportCSV } from '@/lib/utils'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useChartColors } from '@/hooks/use-chart-colors'
import { exportXLSX } from '@/lib/export-xlsx'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/kpi-card'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Landmark, AlertTriangle, TrendingDown, Target, Download, Siren } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonForecast } from '@/components/ui/skeleton-page'
import { LazyChart } from '@/components/ui/lazy-chart'
import { useTranslations } from 'next-intl'

export default function ForecastPage() {
  const t = useTranslations('forecast')
  const cc = useChartColors()
  const [scenario, setScenario] = useState('BASE')
  const [tab, setTab] = useState<'single' | 'compare'>('compare')
  const [lastUpdated] = useState<Date | null>(() => new Date())

  const { data: single, isLoading: loadingSingle, mutate: mutateSingle } = useForecast(scenario)
  const { data: compare, isLoading: loadingCompare, mutate: mutateCompare } = useForecastCompare()

  const loading = loadingSingle || loadingCompare

  async function refresh() {
    await Promise.all([mutateSingle(), mutateCompare()])
  }

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
    { label: t('kpiFinalBalance'), value: fmtEur(endBalance), icon: <Landmark size={20} />, sub: t('kpiBaseScenario'), trend: endBalance > (compare?.initialCash || 0) ? '+' + fmt(endBalance - (compare?.initialCash || 0)) : fmt(endBalance - (compare?.initialCash || 0)), up: endBalance >= (compare?.initialCash || 0) },
    { label: t('kpiGapsDetected'), value: `${gapWeeks.length}`, icon: <AlertTriangle size={20} />, sub: t('kpiGapsSub', { total: baseWeeks.length }), trend: gapWeeks.length === 0 ? t('kpiNoRisk') : t('kpiGapWeeks', { count: gapWeeks.length }), up: gapWeeks.length === 0 },
    { label: t('kpiMinBalance'), value: fmtEur(minBalance), icon: <TrendingDown size={20} />, sub: t('kpiMinBalanceSub'), trend: minBalance > 0 ? t('kpiPositive') : t('kpiNegative'), up: minBalance > 0 },
    { label: t('kpiAvgConfidence'), value: `${avgConfidence}%`, icon: <Target size={20} />, sub: t('kpiConfidenceSub'), trend: avgConfidence >= 80 ? t('kpiHigh') : avgConfidence >= 60 ? t('kpiMedium') : t('kpiLow'), up: avgConfidence >= 70 },
  ]

  const exportCsv = useCallback(() => {
    exportCSV('forecast_comparativa',
      [t('thWeek'), t('thBalanceBase'), t('thBalanceConservative'), t('thBalanceAggressive'), t('thInflowsBase'), t('thOutflowsBase'), t('thConfidenceBase')],
      compareData.map((w: any) => [w.week, w.saldoBase, w.saldoConservador, w.saldoAgresivo, w.cobrosBase, w.pagosBase, w.confBase]))
  }, [compareData, t])

  useKeyboardShortcuts([
    { key: 'e', label: t('shortcutExport'), action: exportCsv },
    { key: 'r', label: t('shortcutRefresh'), action: refresh },
  ])

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonForecast />

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
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              `forecast_comparativa`,
              [t('thWeek'), t('thBalanceBase'), t('thBalanceConservative'), t('thBalanceAggressive'), t('thInflowsBase'), t('thOutflowsBase'), t('thConfidenceBase')],
              compareData.map((w: any) => [w.week, w.saldoBase, w.saldoConservador, w.saldoAgresivo, w.cobrosBase, w.pagosBase, w.confBase])
            )}><Download size={14} className="mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportXLSX(
              `forecast_comparativa`,
              [t('thWeek'), t('thBalanceBase'), t('thBalanceConservative'), t('thBalanceAggressive'), t('thInflowsBase'), t('thOutflowsBase'), t('thConfidenceBase')],
              compareData.map((w: any) => [w.week, w.saldoBase, w.saldoConservador, w.saldoAgresivo, w.cobrosBase, w.pagosBase, w.confBase])
            )}><Download size={14} className="mr-1" />Excel</Button>
          </>
        }
      />

      {/* Alert for gaps */}
      {gapWeeks.length > 0 && (
        <div className="flex gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('alertGapTitle', { count: gapWeeks.length })}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {gapWeeks.map((w: any) => `S${w.weekNumber}`).join(', ')} — {t('alertGapDesc')}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
      </div>

      {/* Tab toggle */}
      <div className="pill-tabs">
        <button onClick={() => setTab('compare')} className={tab === 'compare' ? 'pill-tab-active' : 'pill-tab'}>
          {t('tabCompare')}
        </button>
        <button onClick={() => setTab('single')} className={tab === 'single' ? 'pill-tab-active' : 'pill-tab'}>
          {t('tabDetail')}
        </button>
      </div>

      {tab === 'compare' ? (
        <>
          {/* Comparison: Saldo Acumulado */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>{t('chartCumBalance')}</CardTitle>
                <div className="flex gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30">{t('scenarioBase')}</Badge>
                  <Badge className="bg-warning/20 text-warning border-warning/30">{t('scenarioConservative')}</Badge>
                  <Badge className="bg-success/20 text-success border-success/30">{t('scenarioAggressive')}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cc.primary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={cc.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConservador" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cc.warning} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={cc.warning} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAgresivo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cc.success} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={cc.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                  <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(Number(v)), name]}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke={cc.destructive} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="saldoAgresivo" name={t('scenarioAggressive')} stroke={cc.success} strokeWidth={2} fill="url(#gradAgresivo)" strokeDasharray="5 3" />
                  <Area type="monotone" dataKey="saldoBase" name={t('scenarioBase')} stroke={cc.primary} strokeWidth={2.5} fill="url(#gradBase)" />
                  <Area type="monotone" dataKey="saldoConservador" name={t('scenarioConservative')} stroke={cc.warning} strokeWidth={2} fill="url(#gradConservador)" strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparison: Cobros vs Pagos grouped */}
          <Card>
            <CardHeader><CardTitle>{t('chartInflowsOutflows')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                  <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(Number(v)), name]}
                  />
                  <Legend />
                  <Bar dataKey="cobrosBase" name={t('legendInflowsBase')} fill={cc.primary} fillOpacity={0.8} radius={[2,2,0,0]} />
                  <Bar dataKey="pagosBase" name={t('legendOutflowsBase')} fill={cc.destructive} fillOpacity={0.6} radius={[2,2,0,0]} />
                  <Bar dataKey="cobrosConservador" name={t('legendInflowsConservative')} fill={cc.warning} fillOpacity={0.6} radius={[2,2,0,0]} />
                  <Bar dataKey="cobrosAgresivo" name={t('legendInflowsAggressive')} fill={cc.success} fillOpacity={0.6} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence chart */}
          <Card>
            <CardHeader><CardTitle>{t('chartConfidence')}</CardTitle></CardHeader>
            <CardContent>
              <LazyChart height={200}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(v: any, name: string) => [`${v}%`, name]}
                    />
                    <Legend />
                    <ReferenceLine y={70} stroke={cc.warning} strokeDasharray="4 4" label={{ value: t('confidenceThreshold'), fill: cc.warning, fontSize: 10 }} />
                    <Line type="monotone" dataKey="confBase" name={t('scenarioBase')} stroke={cc.primary} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="confConservador" name={t('scenarioConservative')} stroke={cc.warning} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                    <Line type="monotone" dataKey="confAgresivo" name={t('scenarioAggressive')} stroke={cc.success} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </LazyChart>
            </CardContent>
          </Card>

          {/* Comparison table */}
          <Card>
            <CardHeader><CardTitle>{t('tableCompareTitle')}</CardTitle></CardHeader>
            <ScrollableTable>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">{t('thWeekShort')}</th>
                    <th className="text-right p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]" colSpan={2}>{t('scenarioBase')}</th>
                    <th className="text-right p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]" colSpan={2}>{t('scenarioConservative')}</th>
                    <th className="text-right p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]" colSpan={2}>{t('scenarioAggressive')}</th>
                    <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">{t('thDeltaMax')}</th>
                  </tr>
                  <tr className="border-b border-border bg-muted/30">
                    <th></th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">{t('thNet')}</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">{t('thBalance')}</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">{t('thNet')}</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">{t('thBalance')}</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">{t('thNet')}</th>
                    <th className="text-right p-1.5 text-[9px] text-muted-foreground">{t('thBalance')}</th>
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
                        <td className="p-2.5 font-mono font-bold" style={{ color: w.isGap ? cc.destructive : cc.foreground }}><span className="flex items-center gap-1">{w.week}{w.isGap && <AlertTriangle size={12} />}</span></td>
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
            <span className="text-sm text-muted-foreground">{t('scenarioLabel')}:</span>
            <select value={scenario} onChange={e => setScenario(e.target.value)} className="text-sm bg-card border border-border rounded-md px-3 py-1.5 text-foreground">
              <option value="BASE">{t('scenarioBase')}</option>
              <option value="CONSERVADOR">{t('scenarioConservativeOption')}</option>
              <option value="AGRESIVO">{t('scenarioAggressiveOption')}</option>
            </select>
          </div>

          <Card>
            <CardHeader><CardTitle>{t('chartSingleInflowsOutflows', { scenario })}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={singleData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                  <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip
                    formatter={(v: any) => fmtEur(v)}
                  />
                  <Legend />
                  <Bar dataKey="cobros" name={t('legendInflows')} fill={cc.success} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pagos" name={t('legendOutflows')} fill={cc.destructive} fillOpacity={0.65} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('chartSingleCumBalance', { scenario })}</CardTitle></CardHeader>
            <CardContent>
              <LazyChart height={240}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={singleData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="singleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={cc.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={cc.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                    <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      formatter={(v: any) => [fmtEur(Number(v)), t('tooltipBalance')]}
                    />
                    <ReferenceLine y={0} stroke={cc.destructive} strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="saldo" stroke={cc.primary} strokeWidth={2.5} fill="url(#singleGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </LazyChart>
            </CardContent>
          </Card>

          {/* Single scenario actions + table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>{t('mitigationTitle')}</CardTitle><Badge variant="warning">{t('mitigationOptions')}</Badge></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: t('mitigationAction1'), impact: '+100.000 €', days: t('mitigationAction1Days') },
                  { label: t('mitigationAction2'), impact: '+48.500 €', days: t('mitigationAction2Days') },
                  { label: t('mitigationAction3'), impact: '+18.900 €', days: t('mitigationAction3Days') },
                ].map(a => (
                  <div key={a.label} className="flex items-center justify-between bg-muted rounded-lg p-3 border border-border">
                    <div><div className="text-sm text-foreground">{a.label}</div><div className="text-xs text-muted-foreground mt-0.5">{a.days}</div></div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-success">{a.impact}</span>
                      <Button variant="ghost" size="sm">{t('mitigationActivate')}</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('weeklyPositionTitle', { scenario })}</CardTitle></CardHeader>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">{[t('thWeekShort'), t('thInflows'), t('thOutflows'), t('thNet'), t('thBalance'), t('thConf')].map(h => <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">{h}</th>)}</tr></thead>
                  <tbody>
                    {singleData.map((w: any) => (
                      <tr key={w.week} className={`border-b border-border hover:bg-muted/50 ${w.isGap ? 'bg-destructive/5' : ''}`}>
                        <td className="p-2.5 font-mono font-bold" style={{ color: w.isGap ? cc.destructive : cc.foreground }}><span className="flex items-center gap-1">{w.week}{w.isGap && <AlertTriangle size={12} />}</span></td>
                        <td className="p-2.5 font-mono text-success">{fmt(w.cobros)}</td>
                        <td className="p-2.5 font-mono text-destructive">{fmt(w.pagos)}</td>
                        <td className="p-2.5 font-mono font-semibold" style={{ color: w.neto < 0 ? cc.destructive : cc.success }}>{w.neto > 0 ? '+' : ''}{fmt(w.neto)}</td>
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
