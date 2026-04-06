'use client'
import { useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import { useCockpit, useRecommendations } from '@/hooks/use-api'
import { fmtEur, fmtM, exportCSV } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { KpiCard, KpiCardSkeleton } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { useRouter } from 'next/navigation'
import { Landmark, Calendar, CalendarDays, RefreshCw, BarChart3, TrendingUp, CreditCard, Scale, Download, AlertTriangle, GripVertical, Presentation } from 'lucide-react'
import { ErrorState } from '@/components/ui/error-state'
import { useChartColors } from '@/hooks/use-chart-colors'
import { useHydrated } from '@/hooks/use-hydrated'
import { useAppStore } from '@/store/app'
import { KpiCustomizer } from './_components/kpi-customizer'
import { CompareSelector } from './_components/compare-selector'
import { useTranslations } from 'next-intl'
import { computeDelta, formatTrend } from './_components/kpi-helpers'
import { DrilldownDialog } from './_components/drilldown-dialog'
import { CashCovenantsSection, WorkingCapitalSection, BotRecommendationsSection, TasksSection } from './_components/cockpit-sections'

const PresentationOverlay = lazy(() => import('./_components/presentation-overlay'))

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
  const cashChartRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { cockpitLayout, compareMode, setCockpitSectionOrder } = useAppStore()
  const hydrated = useHydrated()

  const loading = !hydrated || isLoading

  const refresh = useCallback(() => { mutate(); setRefreshKey(k => k + 1) }, [mutate])

  const startPresentation = useCallback(() => {
    setPresenting(true)
    setSlideIdx(0)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  const stopPresentation = useCallback(() => {
    setPresenting(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  const kpis = useMemo(() => {
    if (!data) return []
    return [
      { key: 'caja', label: t('kpiCashToday'), value: fmtEur(data.caja?.value || 1245000), icon: <Landmark size={20} />, sub: t('kpiCashSub', { count: data.caja?.accounts?.length || 4 }), ...formatTrend('caja', data), page: '/dashboard/conciliacion', sparkline: data.caja?.sparkline, tooltip: t('kpiCashTooltip'), source: t('kpiCashSource') },
      { key: 'dso', label: 'DSO', value: `${data.dso?.value || 42} ${t('days')}`, icon: <Calendar size={20} />, sub: t('kpiDsoSub'), ...formatTrend('dso', data), page: '/dashboard/cobros', sparkline: data.dso?.sparkline, tooltip: t('kpiDsoTooltip'), source: t('kpiDsoSource') },
      { key: 'dpo', label: 'DPO', value: `${data.dpo?.value || 67} ${t('days')}`, icon: <CalendarDays size={20} />, sub: t('kpiDpoSub'), ...formatTrend('dpo', data), page: '/dashboard/pagos', sparkline: data.dpo?.sparkline, tooltip: t('kpiDpoTooltip'), source: t('kpiDpoSource') },
      { key: 'ccc', label: 'Cash Conv. Cycle', value: `${data.ccc?.value || 28} ${t('days')}`, icon: <RefreshCw size={20} />, sub: 'DSO - DPO + DIO', ...formatTrend('ccc', data), page: '/dashboard/forecast', sparkline: data.ccc?.sparkline, tooltip: t('kpiCccTooltip'), source: t('kpiCccSource') },
      { key: 'revenue', label: 'Revenue YTD', value: fmtM(data.revenue?.value || 4820000), icon: <BarChart3 size={20} />, sub: t('kpiRevenueSub'), ...formatTrend('revenue', data), page: '/dashboard/variance', sparkline: data.revenue?.sparkline, tooltip: t('kpiRevenueTooltip'), source: t('kpiRevenueSource') },
      { key: 'ebitda', label: 'EBITDA', value: fmtM(data.ebitda?.value || 1150000), icon: <TrendingUp size={20} />, sub: t('kpiEbitdaSub', { margin: data.ebitda?.margin || 23.9 }), ...formatTrend('ebitda', data), page: '/dashboard/variance', sparkline: data.ebitda?.sparkline, tooltip: t('kpiEbitdaTooltip'), source: t('kpiEbitdaSource') },
      { key: 'deudaNeta', label: t('kpiNetDebt'), value: fmtM(data.deudaNeta?.value || 2180000), icon: <CreditCard size={20} />, sub: t('kpiNetDebtSub'), ...formatTrend('deudaNeta', data), page: '/dashboard/deuda', sparkline: data.deudaNeta?.sparkline, tooltip: t('kpiNetDebtTooltip'), source: t('kpiNetDebtSource') },
      { key: 'liquidez', label: t('kpiLiquidity'), value: `${data.liquidez?.value || 1.85}x`, icon: <Scale size={20} />, sub: t('kpiLiquiditySub'), ...formatTrend('liquidez', data), page: '/dashboard/deuda', sparkline: data.liquidez?.sparkline, tooltip: t('kpiLiquidityTooltip'), source: t('kpiLiquiditySource') },
    ]
  }, [data, t])

  const visibleKpis = useMemo(() => {
    const hiddenSet = new Set(cockpitLayout.hidden)
    const orderedKeys = cockpitLayout.order || kpis.map(k => k.key)
    return orderedKeys
      .map(key => kpis.find(k => k.key === key))
      .filter((k): k is typeof kpis[number] => k != null && !hiddenSet.has(k.key))
  }, [kpis, cockpitLayout])

  const cashEvolution = useMemo(() => {
    if (!data) return []
    return (data.cashEvolution || []).map((d: any) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
    }))
  }, [data])

  // Show error state only when loading is done and no data
  if (!loading && !data) return <ErrorState title={t('errorLoading')} description={error?.message} onRetry={() => mutate()} />

  const DEFAULT_SECTION_ORDER = ['cashCovenants', 'workingCapital', 'botRecommendations', 'tasks']
  const sectionOrder = cockpitLayout.sectionOrder || DEFAULT_SECTION_ORDER

  const sectionComponents: Record<string, React.ReactNode> = data ? {
    cashCovenants: <CashCovenantsSection data={data} cashEvolution={cashEvolution} cashChartRef={cashChartRef} cc={cc} />,
    workingCapital: <WorkingCapitalSection data={data} />,
    botRecommendations: <BotRecommendationsSection recommendations={recommendations} recsLoading={recsLoading} />,
    tasks: <TasksSection data={data} />,
  } : {}

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

      {/* KPI Grid - Progressive loading */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t('kpisVisible', { visible: visibleKpis.length || 8, total: kpis.length || 8 })}</span>
          <CompareSelector />
        </div>
        <KpiCustomizer kpis={(kpis.length > 0 ? kpis : Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, label: `KPI ${i}`, icon: null }))).map(k => ({ key: k.key, label: k.label, icon: k.icon }))} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }, (_, i) => <KpiCardSkeleton key={i} index={i} />)
        ) : (
          visibleKpis.map((k, i) => {
            const raw = data[k.key as keyof typeof data] as any
            const currentVal = raw?.value ?? 0
            const delta = computeDelta(k.key, currentVal, compareMode)
            return <KpiCard key={`${k.key}-${refreshKey}`} {...k} index={i} delta={delta} onClick={() => setDrilldown(k.key)} />
          })
        )}
      </div>

      {/* Drill-down Modal */}
      <DrilldownDialog
        drilldown={drilldown}
        kpis={visibleKpis}
        data={data}
        onClose={() => setDrilldown(null)}
        onNavigate={(path) => { setDrilldown(null); router.push(path) }}
      />

      {/* Draggable Sections - render progressively */}
      {data && sectionOrder.filter(k => k in sectionComponents).map(key => (
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
          <div className="absolute -left-2 top-3 z-10 opacity-0 group-hover/drag:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
            <div className="w-6 h-8 rounded-md bg-muted/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
              <GripVertical size={14} />
            </div>
          </div>
          {sectionComponents[key]}
        </div>
      ))}

      {/* Presentation Mode Overlay */}
      {presenting && (
        <Suspense fallback={null}>
          <PresentationOverlay
            kpis={visibleKpis}
            data={data}
            compareMode={compareMode}
            computeDelta={computeDelta}
            slideIdx={slideIdx}
            setSlideIdx={setSlideIdx}
            onClose={stopPresentation}
          />
        </Suspense>
      )}
    </div>
  )
}
