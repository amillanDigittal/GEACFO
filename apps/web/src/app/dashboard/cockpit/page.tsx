'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useCockpit, useRecommendations } from '@/hooks/use-api'
import { fmtEur, fmtM, fmt, fmtPct, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { KpiCard } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Landmark, Calendar, CalendarDays, RefreshCw, BarChart3, TrendingUp, CreditCard, Scale, Download, FileText, AlertTriangle, AlertCircle, CircleDot, ExternalLink, ArrowRight, Bot, Sparkles, GripVertical, Presentation, X as XIcon, ArrowUp, ArrowDown } from 'lucide-react'
import { SkeletonCockpit } from '@/components/ui/skeleton-page'
import { LazyChart } from '@/components/ui/lazy-chart'
import { ChartEmpty } from '@/components/ui/chart-empty'
import { useChartColors } from '@/hooks/use-chart-colors'
import { useHydrated } from '@/hooks/use-hydrated'
import { useAppStore } from '@/store/app'
import { KpiCustomizer } from './_components/kpi-customizer'
import { CompareSelector } from './_components/compare-selector'
import type { CompareMode } from '@/store/app'
import { useTranslations } from 'next-intl'

// Previous-period values for each KPI and comparison mode
const PREV: Record<string, Record<CompareMode, { value: number; label: string }>> = {
  caja:      { mom: { value: 1208000, label: 'feb' },  yoy: { value: 980000,  label: 'mar 25' } },
  dso:       { mom: { value: 45,      label: 'feb' },  yoy: { value: 52,      label: 'mar 25' } },
  dpo:       { mom: { value: 65,      label: 'feb' },  yoy: { value: 58,      label: 'mar 25' } },
  ccc:       { mom: { value: 30,      label: 'feb' },  yoy: { value: 38,      label: 'mar 25' } },
  revenue:   { mom: { value: 4290000, label: 'feb' },  yoy: { value: 3950000, label: 'mar 25' } },
  ebitda:    { mom: { value: 1080000, label: 'feb' },  yoy: { value: 870000,  label: 'mar 25' } },
  deudaNeta: { mom: { value: 2210000, label: 'feb' },  yoy: { value: 2650000, label: 'mar 25' } },
  liquidez:  { mom: { value: 1.80,    label: 'feb' },  yoy: { value: 1.52,    label: 'mar 25' } },
}

/** Whether a positive delta is "good" for each KPI (lower is better for debt/days) */
const POSITIVE_IS_GOOD: Record<string, boolean> = {
  caja: true, dso: false, dpo: true, ccc: false,
  revenue: true, ebitda: true, deudaNeta: false, liquidez: true,
}

function computeDelta(key: string, current: number, mode: CompareMode) {
  const prev = PREV[key]?.[mode]
  if (!prev) return undefined
  const diff = current - prev.value
  const pct = prev.value !== 0 ? (diff / prev.value) * 100 : 0
  const isPositive = POSITIVE_IS_GOOD[key] ? diff > 0 : diff < 0

  // Format delta text based on KPI type
  let text: string
  if (key === 'dso' || key === 'dpo' || key === 'ccc') {
    text = `${diff > 0 ? '+' : ''}${diff}d vs ${prev.label}`
  } else if (key === 'liquidez') {
    text = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}x vs ${prev.label}`
  } else {
    text = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs ${prev.label}`
  }
  return { text, positive: isPositive }
}

function DrilldownRow({ label, value, highlight, pct }: { label: string; value: string; highlight?: boolean; pct?: number }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {pct !== undefined && (
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        )}
        <span className={`font-mono text-sm font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</span>
      </div>
    </div>
  )
}

function SparklineChart({ data, label }: { data: number[]; label: string }) {
  if (!data || data.length < 2) return null
  const chartData = data.map((v, i) => ({ i: i + 1, value: v }))
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="drillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Tooltip formatter={(v: any) => [label.includes('d') || label.includes('x') ? v : fmtEur(Number(v)), label]} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#drillGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function CockpitPage() {
  const t = useTranslations('cockpit')
  const { data, error, isLoading, mutate } = useCockpit()
  const { data: recsData, isLoading: recsLoading } = useRecommendations()
  const recommendations = recsData?.recommendations || []
  const [drilldown, setDrilldown] = useState<string | null>(null)
  const [lastUpdated] = useState(() => new Date())
  const [presenting, setPresenting] = useState(false)
  const [slideIdx, setSlideIdx] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const cc = useChartColors()
  const router = useRouter()
  const { cockpitLayout, compareMode, setCockpitSectionOrder } = useAppStore()
  const hydrated = useHydrated()

  const loading = !hydrated || isLoading

  function refresh() { mutate(); setRefreshKey(k => k + 1) }

  // Presentation mode: fullscreen + auto-rotate
  function startPresentation() {
    setPresenting(true)
    setSlideIdx(0)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  function stopPresentation() {
    setPresenting(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  if (loading) return <SkeletonCockpit />
  if (!data) return <div className="text-center text-muted-foreground py-20">{t('errorLoading')}{error && <p className="mt-2 text-xs text-destructive">{error.message}</p>}</div>

  const kpis = [
    { key: 'caja', label: t('kpiCashToday'), value: fmtEur(data.caja?.value || 1245000), icon: <Landmark size={20} />, sub: t('kpiCashSub', { count: data.caja?.accounts?.length || 4 }), trend: '+3.2%', up: true, page: '/dashboard/conciliacion', sparkline: data.caja?.sparkline, tooltip: t('kpiCashTooltip'), source: t('kpiCashSource') },
    { key: 'dso', label: 'DSO', value: `${data.dso?.value || 42} ${t('days')}`, icon: <Calendar size={20} />, sub: t('kpiDsoSub'), trend: '-3d', up: true, page: '/dashboard/cobros', sparkline: data.dso?.sparkline, tooltip: t('kpiDsoTooltip'), source: t('kpiDsoSource') },
    { key: 'dpo', label: 'DPO', value: `${data.dpo?.value || 67} ${t('days')}`, icon: <CalendarDays size={20} />, sub: t('kpiDpoSub'), trend: '+2d', up: true, page: '/dashboard/pagos', sparkline: data.dpo?.sparkline, tooltip: t('kpiDpoTooltip'), source: t('kpiDpoSource') },
    { key: 'ccc', label: 'Cash Conv. Cycle', value: `${data.ccc?.value || 28} ${t('days')}`, icon: <RefreshCw size={20} />, sub: 'DSO - DPO + DIO', trend: '-2d', up: true, page: '/dashboard/forecast', sparkline: data.ccc?.sparkline, tooltip: t('kpiCccTooltip'), source: t('kpiCccSource') },
    { key: 'revenue', label: 'Revenue YTD', value: fmtM(data.revenue?.value || 4820000), icon: <BarChart3 size={20} />, sub: t('kpiRevenueSub'), trend: '+12.3%', up: true, page: '/dashboard/variance', sparkline: data.revenue?.sparkline, tooltip: t('kpiRevenueTooltip'), source: t('kpiRevenueSource') },
    { key: 'ebitda', label: 'EBITDA', value: fmtM(data.ebitda?.value || 1150000), icon: <TrendingUp size={20} />, sub: t('kpiEbitdaSub', { margin: data.ebitda?.margin || 23.9 }), trend: '+0.8pp', up: true, page: '/dashboard/variance', sparkline: data.ebitda?.sparkline, tooltip: t('kpiEbitdaTooltip'), source: t('kpiEbitdaSource') },
    { key: 'deudaNeta', label: t('kpiNetDebt'), value: fmtM(data.deudaNeta?.value || 2180000), icon: <CreditCard size={20} />, sub: t('kpiNetDebtSub'), trend: '-1.2%', up: true, page: '/dashboard/deuda', sparkline: data.deudaNeta?.sparkline, tooltip: t('kpiNetDebtTooltip'), source: t('kpiNetDebtSource') },
    { key: 'liquidez', label: t('kpiLiquidity'), value: `${data.liquidez?.value || 1.85}x`, icon: <Scale size={20} />, sub: t('kpiLiquiditySub'), trend: '+0.05x', up: true, page: '/dashboard/deuda', sparkline: data.liquidez?.sparkline, tooltip: t('kpiLiquidityTooltip'), source: t('kpiLiquiditySource') },
  ]

  // Apply user layout: reorder + hide
  const hiddenSet = new Set(cockpitLayout.hidden)
  const orderedKeys = cockpitLayout.order || kpis.map(k => k.key)
  const visibleKpis = orderedKeys
    .map(key => kpis.find(k => k.key === key))
    .filter((k): k is typeof kpis[number] => k != null && !hiddenSet.has(k.key))

  const activeKpi = kpis.find(k => k.key === drilldown)

  const cashEvolution = (data.cashEvolution || []).map((d: any) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
  }))

  // Drill-down content for each KPI
  function renderDrilldown() {
    if (!drilldown || !activeKpi) return null

    const totalCash = data.caja?.value || 1245000
    const ar = data.workingCapital?.ar || 964850
    const ap = data.workingCapital?.ap || 146550
    const dsoVal = data.dso?.value || 42
    const dpoVal = data.dpo?.value || 67
    const cccVal = data.ccc?.value || 28
    const revenueVal = data.revenue?.value || 4820000
    const ebitdaVal = data.ebitda?.value || 1150000
    const deudaVal = data.deudaNeta?.value || 2180000
    const liquidezVal = data.liquidez?.value || 1.85

    switch (drilldown) {
      case 'caja': {
        const accounts = data.caja?.accounts || []
        return (
          <>
            <DialogDescription>{t('drillCashDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              {accounts.map((a: any) => (
                <DrilldownRow
                  key={a.name}
                  label={a.name}
                  value={fmtEur(a.balance)}
                  pct={totalCash > 0 ? (a.balance / totalCash) * 100 : 0}
                />
              ))}
              <DrilldownRow label={t('drillCashTotal')} value={fmtEur(totalCash)} highlight />
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('drillCashSparkLabel')} />
          </>
        )
      }
      case 'dso': {
        const months = [t('monthJan'), t('monthFeb'), t('monthMar')]
        const dsoTrend = data.dso?.sparkline?.slice(-3) || [45, 43, dsoVal]
        return (
          <>
            <DialogDescription>{t('drillDsoDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillDsoCurrent')} value={`${dsoVal} ${t('days')}`} highlight />
              <DrilldownRow label={t('drillDsoTarget')} value={`45 ${t('days')}`} />
              <DrilldownRow label={t('drillDsoDiffTarget')} value={`${dsoVal - 45 > 0 ? '+' : ''}${dsoVal - 45}d`} />
              <DrilldownRow label={t('drillDsoAR')} value={fmtEur(ar)} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-medium mb-1">{t('drillMonthlyEvolution')}</div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <div key={m} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{m}</div>
                  <div className="font-mono text-sm font-bold">{dsoTrend[i]}d</div>
                </div>
              ))}
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('days')} />
          </>
        )
      }
      case 'dpo': {
        const months = [t('monthJan'), t('monthFeb'), t('monthMar')]
        const dpoTrend = data.dpo?.sparkline?.slice(-3) || [64, 66, dpoVal]
        return (
          <>
            <DialogDescription>{t('drillDpoDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillDpoCurrent')} value={`${dpoVal} ${t('days')}`} highlight />
              <DrilldownRow label={t('drillDpoAP')} value={fmtEur(ap)} />
              <DrilldownRow label={t('drillDpoTrend')} value={t('drillDpoTrendValue')} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-medium mb-1">{t('drillMonthlyEvolution')}</div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <div key={m} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{m}</div>
                  <div className="font-mono text-sm font-bold">{dpoTrend[i]}d</div>
                </div>
              ))}
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('days')} />
          </>
        )
      }
      case 'ccc': {
        const dio = cccVal - dsoVal + dpoVal
        return (
          <>
            <DialogDescription>{t('drillCccDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillCccDso')} value={`${dsoVal} ${t('days')}`} />
              <DrilldownRow label={t('drillCccDio')} value={`${dio} ${t('days')}`} />
              <DrilldownRow label={t('drillCccDpo')} value={`-${dpoVal} ${t('days')}`} />
              <div className="border-t border-border mt-1 pt-1">
                <DrilldownRow label="CCC = DSO + DIO - DPO" value={`${cccVal} ${t('days')}`} highlight />
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              {t('drillCccInsight')}
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('days')} />
          </>
        )
      }
      case 'revenue': {
        const monthly = [
          { month: t('monthJanShort'), value: 1540000 },
          { month: t('monthFebShort'), value: 1620000 },
          { month: t('monthMarShort'), value: 1660000 },
        ]
        return (
          <>
            <DialogDescription>{t('drillRevenueDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              {monthly.map(m => (
                <DrilldownRow
                  key={m.month}
                  label={m.month}
                  value={fmtEur(m.value)}
                  pct={(m.value / revenueVal) * 100}
                />
              ))}
              <DrilldownRow label={t('drillRevenueTotalYtd')} value={fmtEur(revenueVal)} highlight />
              <DrilldownRow label={t('drillRevenueGrowth')} value="+12,3%" />
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={monthly} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: any) => [fmtEur(Number(v)), 'Revenue']}
                  />
                  <Bar dataKey="value" fill={cc.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      }
      case 'ebitda': {
        const margin = data.ebitda?.margin || 23.9
        return (
          <>
            <DialogDescription>{t('drillEbitdaDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label="Revenue YTD" value={fmtEur(revenueVal)} />
              <DrilldownRow label="EBITDA" value={fmtEur(ebitdaVal)} highlight />
              <DrilldownRow label={t('drillEbitdaMargin')} value={fmtPct(margin)} pct={margin} />
              <DrilldownRow label={t('drillEbitdaMarginChange')} value={t('drillEbitdaMarginChangeValue')} />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <div className="flex justify-between mb-1"><span>{t('drillEbitdaOpex')}</span><span className="font-mono font-semibold">{fmtEur(revenueVal - ebitdaVal)}</span></div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${margin}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px]"><span>EBITDA {fmtPct(margin)}</span><span>OpEx {fmtPct(100 - margin)}</span></div>
            </div>
            <SparklineChart data={activeKpi.sparkline} label="EBITDA" />
          </>
        )
      }
      case 'deudaNeta': {
        const deudaBruta = deudaVal + totalCash
        return (
          <>
            <DialogDescription>{t('drillNetDebtDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillNetDebtGross')} value={fmtEur(deudaBruta)} />
              <DrilldownRow label={t('drillNetDebtCash')} value={`-${fmtEur(totalCash)}`} />
              <DrilldownRow label={t('kpiNetDebt')} value={fmtEur(deudaVal)} highlight />
              <DrilldownRow label={t('drillNetDebtEbitdaRatio')} value={`${fmt(deudaVal / ebitdaVal, 1)}x`} />
              <DrilldownRow label={t('drillNetDebtTrend')} value={t('drillNetDebtTrendValue')} />
            </div>
            <SparklineChart data={activeKpi.sparkline} label={t('kpiNetDebt')} />
          </>
        )
      }
      case 'liquidez': {
        const activoCorr = ap * liquidezVal + totalCash
        const pasivoCorr = ap + totalCash * 0.1
        return (
          <>
            <DialogDescription>{t('drillLiquidityDesc')}</DialogDescription>
            <div className="space-y-1 mt-2">
              <DrilldownRow label={t('drillLiquidityCurrent')} value={`${liquidezVal}x`} highlight />
              <DrilldownRow label={t('drillLiquidityMinTarget')} value="1,20x" />
              <DrilldownRow label={t('drillLiquidityMargin')} value={`+${fmt((liquidezVal - 1.2) / 1.2 * 100, 0)}%`} />
              <DrilldownRow label={t('drillLiquidityTrend')} value={t('drillLiquidityTrendValue')} />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              {t('drillLiquidityInsight')}
            </div>
            <SparklineChart data={activeKpi.sparkline} label="x" />
          </>
        )
      }
      default:
        return null
    }
  }

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
            <Button variant="outline" size="sm" onClick={() => exportCSV('cockpit_kpis', ['KPI', t('thValue'), t('thTrend')], kpis.map(k => [k.label, k.value, k.trend]))}><Download size={14} className="mr-1" />{t('exportBtn')}</Button>
            <Button variant="outline" size="sm" onClick={startPresentation}><Presentation size={14} className="mr-1" />Presentación</Button>
            <Button size="sm" onClick={() => router.push('/dashboard/boardpack')}><FileText size={14} className="mr-1" />Board Pack</Button>
          </>
        }
      />

      {/* Alert */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold text-sm">{t('alertGapTitle')}</div>
          <div className="text-xs opacity-80 mt-0.5">{t('alertGapDesc')} <span className="underline cursor-pointer" onClick={() => router.push('/dashboard/forecast')}>{t('alertGapLink')}</span></div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t('kpisVisible', { visible: visibleKpis.length, total: kpis.length })}</span>
          <CompareSelector />
        </div>
        <KpiCustomizer kpis={kpis.map(k => ({ key: k.key, label: k.label, icon: k.icon }))} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleKpis.map((k, i) => {
          const raw = data[k.key as keyof typeof data] as any
          const currentVal = raw?.value ?? 0
          const delta = computeDelta(k.key, currentVal, compareMode)
          return <KpiCard key={`${k.key}-${refreshKey}`} {...k} index={i} delta={delta} onClick={() => setDrilldown(k.key)} />
        })}
      </div>

      {/* Drill-down Modal */}
      <Dialog open={!!drilldown} onOpenChange={(open) => { if (!open) setDrilldown(null) }}>
        <DialogContent className="max-w-md">
          {activeKpi && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-primary">{activeKpi.icon}</span>
                  <DialogTitle>{activeKpi.label}: {activeKpi.value}</DialogTitle>
                </div>
              </DialogHeader>
              {renderDrilldown()}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => { setDrilldown(null); router.push(activeKpi.page) }}
                >
                  {t('goTo', { label: activeKpi.label })} <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Draggable Sections ── */}
      {(() => {
        const DEFAULT_SECTION_ORDER = ['cashCovenants', 'workingCapital', 'botRecommendations', 'tasks']
        const sectionOrder = cockpitLayout.sectionOrder || DEFAULT_SECTION_ORDER

        const sectionRenderers: Record<string, () => React.ReactNode> = {
          cashCovenants: () => (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card data-accent="primary">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <CardTitle>{t('cashEvolutionTitle')}</CardTitle>
                      {cashEvolution.length > 0 && (
                        <Badge variant="secondary">{t('cashEvolutionDays', { count: cashEvolution.length })}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {cashEvolution.length > 1 ? (
                      <LazyChart height={220}>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={cashEvolution} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <defs>
                              <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={cc.primary} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={cc.primary} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: cc.mutedForeground }} />
                            <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                            <Tooltip formatter={(v: any) => [fmtEur(Number(v)), t('tooltipBalance')]} />
                            <Area type="monotone" dataKey="balance" stroke={cc.primary} strokeWidth={2} fill="url(#cashGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </LazyChart>
                    ) : (
                      <ChartEmpty message={t('cashEvolutionNoData')} height={220} />
                    )}
                  </CardContent>
                </Card>
              </div>
              <Card data-glow="success" data-accent="success">
                <CardHeader><CardTitle>{t('covenantsTitle')}</CardTitle><Badge variant="success">{t('covenantsOk')}</Badge></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {['Net Debt/EBITDA','DSCR',t('covenantMinLiquidity'),t('covenantCoverageRatio')].map((name, i) => {
                      const margins = ['40%','21%','149%','40%']
                      const values = [2.1, 1.45, 3.73, 2.1]
                      const limits = [3.5, 1.2, 1.5, 1.5]
                      const pcts = [60, 79, 40, 72]
                      const pct = pcts[i]
                      const R = 36, CX = 44, CY = 44, SW = 6
                      const halfCirc = Math.PI * R
                      const filled = halfCirc * (pct / 100)
                      const gap = halfCirc - filled
                      return (
                        <div key={name} className="flex flex-col items-center text-center">
                          <svg width={88} height={52} viewBox="0 0 88 52" className="overflow-visible">
                            <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="hsl(var(--muted))" strokeWidth={SW} strokeLinecap="round" />
                            <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke={pct >= 80 ? 'hsl(var(--destructive))' : pct >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--success))'} strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${filled} ${gap}`} className="covenant-ring" style={{ '--ring-fill': `${filled}` } as React.CSSProperties} />
                            <text x={CX} y={CY - 6} textAnchor="middle" className="fill-foreground text-[13px] font-mono font-bold">{values[i]}</text>
                            <text x={CX} y={CY + 6} textAnchor="middle" className="fill-muted-foreground text-[8px]">lím {limits[i]}</text>
                          </svg>
                          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{name}</span>
                          <span className="text-[10px] font-semibold text-success">+{margins[i]}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ),
          workingCapital: () => {
            const arVal = data.workingCapital?.ar || 964850
            const apVal = data.workingCapital?.ap || 146550
            const invVal = 110450
            const nofVal = arVal - apVal + invVal
            const maxVal = Math.max(arVal, apVal, invVal, nofVal)
            const rows = [
              { label: t('wcClients'), value: fmtEur(arVal), raw: arVal },
              { label: t('wcSuppliers'), value: `-${fmtEur(apVal)}`, raw: apVal },
              { label: t('wcInventory'), value: fmtEur(invVal), raw: invVal },
              { label: t('wcNofTotal'), value: fmtEur(nofVal), raw: nofVal, highlight: true },
            ]
            return (
            <Card>
              <CardHeader><CardTitle>{t('workingCapitalTitle')}</CardTitle></CardHeader>
              <CardContent>
                {rows.map(r => (
                  <div key={r.label} className="stat-row relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.07] rounded" style={{ width: `${(r.raw / maxVal) * 100}%`, background: r.highlight ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }} />
                    <span className="stat-label relative z-[1]">{r.label}</span>
                    <span className={`stat-value relative z-[1] ${r.highlight ? 'text-primary' : ''}`}>{r.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )},
          botRecommendations: () => (
            <Card data-glow="primary" className="bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles size={16} className="text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{t('botRecommendsTitle')}</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('botRecommendsSub')}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => router.push('/dashboard/bot')}>
                    <Bot size={14} /> {t('botOpen')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {recsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : recommendations.length > 0 ? (
                  <div className="space-y-2">
                    {recommendations.map((rec: any, i: number) => {
                      const priorityStyles = {
                        critical: { border: 'border-destructive/30', bg: 'bg-destructive/5', dot: 'bg-destructive', badge: 'destructive' as const },
                        warning: { border: 'border-warning/30', bg: 'bg-warning/5', dot: 'bg-warning', badge: 'warning' as const },
                        info: { border: 'border-primary/30', bg: 'bg-primary/5', dot: 'bg-primary', badge: 'secondary' as const },
                      }
                      const style = priorityStyles[rec.priority as keyof typeof priorityStyles] || priorityStyles.info
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3.5 rounded-lg border ${style.border} ${style.bg}`}>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{rec.title}</span>
                              {rec.metric && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{rec.metric}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{rec.action}</p>
                            {rec.impact && (
                              <span className="inline-block mt-1 text-[10px] font-mono font-semibold text-primary">{rec.impact}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-muted-foreground">{t('botNoRecommendations')}</div>
                )}
              </CardContent>
            </Card>
          ),
          tasks: () => (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <CardTitle>{t('tasksTitle')}</CardTitle>
                  {data.tasks && <Badge variant="secondary">{t('tasksActive', { count: data.tasks.length })}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(data.tasks && data.tasks.length > 0) ? data.tasks.map((t_: any) => {
                  const icon = t_.type === 'critical'
                    ? <AlertCircle size={16} className="text-destructive" />
                    : t_.type === 'warning'
                    ? <CircleDot size={16} className="text-warning" />
                    : <CircleDot size={16} className="text-success" />
                  return (
                    <div key={t_.task} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(t_.page)}>
                      <span>{icon}</span>
                      <span className="flex-1 text-sm text-foreground">{t_.task}</span>
                      <span className={`font-mono text-xs font-semibold ${t_.positive ? 'text-success' : 'text-destructive'}`}>{t_.impact}</span>
                    </div>
                  )
                }) : (
                  <div className="px-5 py-4 text-sm text-muted-foreground text-center">{t('tasksNone')}</div>
                )}
              </CardContent>
            </Card>
          ),
        }

        return sectionOrder.filter(k => k in sectionRenderers).map(key => (
          <div
            key={key}
            draggable
            onDragStart={e => { e.dataTransfer.setData('text/plain', key); e.dataTransfer.effectAllowed = 'move'; (e.currentTarget as HTMLElement).classList.add('dragging-section') }}
            onDragEnd={e => { (e.currentTarget as HTMLElement).classList.remove('dragging-section') }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; (e.currentTarget as HTMLElement).classList.add('drag-over-section') }}
            onDragLeave={e => { (e.currentTarget as HTMLElement).classList.remove('drag-over-section') }}
            onDrop={e => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.remove('drag-over-section')
              const from = e.dataTransfer.getData('text/plain')
              const to = key
              if (from === to) return
              const order = [...sectionOrder]
              const fi = order.indexOf(from)
              const ti = order.indexOf(to)
              if (fi < 0 || ti < 0) return
              order.splice(fi, 1)
              order.splice(ti, 0, from)
              setCockpitSectionOrder(order)
            }}
            className="relative group/drag"
          >
            {/* Drag handle */}
            <div className="absolute -left-2 top-3 z-10 opacity-0 group-hover/drag:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
              <div className="w-6 h-8 rounded-md bg-muted/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                <GripVertical size={14} />
              </div>
            </div>
            {sectionRenderers[key]()}
          </div>
        ))
      })()}

      {/* ── Presentation Mode Overlay ── */}
      {presenting && (
        <PresentationOverlay
          kpis={visibleKpis}
          data={data}
          compareMode={compareMode}
          computeDelta={computeDelta}
          slideIdx={slideIdx}
          setSlideIdx={setSlideIdx}
          onClose={stopPresentation}
        />
      )}
    </div>
  )
}

/* ── Presentation fullscreen component ── */
function PresentationOverlay({
  kpis, data, compareMode, computeDelta, slideIdx, setSlideIdx, onClose,
}: {
  kpis: any[]; data: any; compareMode: any; computeDelta: any
  slideIdx: number; setSlideIdx: (v: number | ((p: number) => number)) => void; onClose: () => void
}) {
  const [progress, setProgress] = useState(0)
  const INTERVAL = 10000

  // Auto-rotate slides
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      setProgress(Math.min((elapsed % INTERVAL) / INTERVAL * 100, 100))
    }
    const raf = setInterval(tick, 50)
    const rotate = setInterval(() => {
      setSlideIdx((prev: number) => (prev + 1) % kpis.length)
    }, INTERVAL)
    return () => { clearInterval(raf); clearInterval(rotate) }
  }, [slideIdx, kpis.length, setSlideIdx])

  // Keyboard: Escape to close, arrows to navigate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setSlideIdx((slideIdx + 1) % kpis.length) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setSlideIdx((slideIdx - 1 + kpis.length) % kpis.length) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slideIdx, kpis.length, setSlideIdx, onClose])

  // Listen for fullscreen exit
  useEffect(() => {
    function onFsChange() { if (!document.fullscreenElement) onClose() }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [onClose])

  const k = kpis[slideIdx]
  if (!k) return null
  const raw = data[k.key as keyof typeof data] as any
  const currentVal = raw?.value ?? 0
  const delta = computeDelta(k.key, currentVal, compareMode)

  return (
    <div className="fixed inset-0 z-[999] bg-background flex flex-col items-center justify-center presentation-enter">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-[hsl(var(--gold))] rounded-lg flex items-center justify-center">
            <BarChart3 size={16} className="text-white" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">GEACFO</span>
          <span className="text-xs text-muted-foreground font-mono ml-2">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <XIcon size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30">
        <div className="h-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>

      {/* Main slide */}
      <div key={slideIdx} className="flex flex-col items-center gap-6 presentation-slide">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <span className="scale-[2]">{k.icon}</span>
        </div>
        <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-semibold">{k.label}</div>
        <div className="font-mono text-7xl md:text-8xl font-bold text-foreground tracking-tight">{k.value}</div>
        {k.trend && (
          <div className={`flex items-center gap-2 text-2xl font-semibold ${k.up ? 'text-success' : 'text-destructive'}`}>
            {k.up ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
            <span>{k.trend}</span>
          </div>
        )}
        {delta && (
          <div className={`text-lg font-mono ${delta.positive ? 'text-success' : 'text-destructive'}`}>{delta.text}</div>
        )}
        {k.sub && <div className="text-sm text-muted-foreground">{k.sub}</div>}
      </div>

      {/* Bottom dots */}
      <div className="absolute bottom-8 flex items-center gap-2">
        {kpis.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlideIdx(i)}
            className={`rounded-full transition-all ${i === slideIdx ? 'w-8 h-2 bg-primary' : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'}`}
          />
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 text-[10px] text-muted-foreground/50">
        ← → para navegar · Esc para salir · Auto-rota cada 10s
      </div>
    </div>
  )
}
