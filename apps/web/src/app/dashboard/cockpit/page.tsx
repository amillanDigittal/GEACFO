'use client'
import { useState } from 'react'
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
import { Landmark, Calendar, CalendarDays, RefreshCw, BarChart3, TrendingUp, CreditCard, Scale, Download, FileText, AlertTriangle, AlertCircle, CircleDot, ExternalLink, ArrowRight, Bot, Sparkles } from 'lucide-react'
import { SkeletonCockpit } from '@/components/ui/skeleton-page'
import { LazyChart } from '@/components/ui/lazy-chart'
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
        <Tooltip
          formatter={(v: any) => [label.includes('d') || label.includes('x') ? v : fmtEur(Number(v)), label]}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--card-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                        labelStyle={{ color: 'hsl(var(--card-foreground))' }}
        />
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
  const cc = useChartColors()
  const router = useRouter()
  const { cockpitLayout, compareMode } = useAppStore()
  const hydrated = useHydrated()

  const loading = !hydrated || isLoading

  function refresh() { mutate() }

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
                    contentStyle={{ background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 8, fontSize: 11, color: cc.cardForeground }}
                    itemStyle={{ color: cc.cardForeground }}
                    labelStyle={{ color: cc.cardForeground }}
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
          return <KpiCard key={k.key} {...k} index={i} delta={delta} onClick={() => setDrilldown(k.key)} />
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

      {/* Cash Evolution Chart + Working Capital */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
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
                      <Tooltip
                        formatter={(v: any) => [fmtEur(Number(v)), t('tooltipBalance')]}
                        contentStyle={{ background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 8, fontSize: 12, color: cc.cardForeground }}
                        itemStyle={{ color: cc.cardForeground }}
                        labelStyle={{ color: cc.cardForeground }}
                      />
                      <Area type="monotone" dataKey="balance" stroke={cc.primary} strokeWidth={2} fill="url(#cashGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </LazyChart>
              ) : (
                <div className="text-center py-10 text-sm text-muted-foreground">{t('cashEvolutionNoData')}</div>
              )}
            </CardContent>
          </Card>
        </div>
        <Card data-glow="success">
          <CardHeader><CardTitle>{t('covenantsTitle')}</CardTitle><Badge variant="success">{t('covenantsOk')}</Badge></CardHeader>
          <CardContent className="space-y-3">
            {['Net Debt/EBITDA','DSCR',t('covenantMinLiquidity'),t('covenantCoverageRatio')].map((name, i) => {
              const margins = ['40%','21%','149%','40%']
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{name}</span><span className="text-success font-semibold">+{margins[i]}</span></div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${[60,79,40,72][i]}%` }} /></div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Working Capital */}
      <Card>
        <CardHeader><CardTitle>{t('workingCapitalTitle')}</CardTitle></CardHeader>
        <CardContent>
          {[
            { label: t('wcClients'), value: fmtEur(data.workingCapital?.ar || 964850) },
            { label: t('wcSuppliers'), value: `-${fmtEur(data.workingCapital?.ap || 146550)}` },
            { label: t('wcInventory'), value: fmtEur(110450) },
            { label: t('wcNofTotal'), value: fmtEur((data.workingCapital?.ar || 964850) - (data.workingCapital?.ap || 146550) + 110450), highlight: true },
          ].map(r => (
            <div key={r.label} className="stat-row">
              <span className="stat-label">{r.label}</span>
              <span className={`stat-value ${r.highlight ? 'text-primary' : ''}`}>{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bot CFO Recommendations */}
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

      {/* Tasks */}
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
    </div>
  )
}
