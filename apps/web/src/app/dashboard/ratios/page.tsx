'use client'
import { useState } from 'react'
import { useRatios } from '@/hooks/use-api'
import { useHydrated } from '@/hooks/use-hydrated'
import { fmtEur, fmt, fmtPct } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { KpiBox } from '@/components/kpi-box'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

const CATEGORY_KEYS: Record<string, string> = {
  liquidity: 'categoryLiquidity',
  solvency: 'categorySolvency',
  profitability: 'categoryProfitability',
  efficiency: 'categoryEfficiency',
}

const CATEGORY_COLORS: Record<string, string> = {
  liquidity: 'hsl(var(--primary))',
  solvency: 'hsl(var(--warning))',
  profitability: 'hsl(var(--success))',
  efficiency: 'hsl(var(--chart-blue))',
}

interface Ratio {
  id: string; category: string; name: string; formula: string; value: number; unit: string
  benchmark: { sector: number; min: number; max: number; good: 'above' | 'below' }
  description: string; components: Record<string, number>
}

function getSignalKey(ratio: Ratio): string {
  const { value, unit, benchmark } = ratio
  const v = unit === '%' ? value : value
  const sector = benchmark.sector
  if (benchmark.good === 'above') {
    if (v >= sector * 1.1) return 'healthy'
    if (v >= sector * 0.8) return 'warning'
    return 'critical'
  } else {
    if (v <= sector * 0.9) return 'healthy'
    if (v <= sector * 1.2) return 'warning'
    return 'critical'
  }
}

function getSignalIcon(key: string): React.ReactNode {
  if (key === 'healthy') return <CheckCircle2 size={14} />
  if (key === 'warning') return <AlertTriangle size={14} />
  return <XCircle size={14} />
}

function getSignalColor(key: string): string {
  if (key === 'healthy') return 'text-success'
  if (key === 'warning') return 'text-warning'
  return 'text-destructive'
}

function fmtRatio(value: number, unit: string) {
  if (unit === '€') return fmtEur(Math.round(value))
  if (unit === '%') return `${fmt(value, 1)}%`
  return `${fmt(value, 2)}x`
}

function GaugeBar({ value, benchmark }: { value: number; benchmark: Ratio['benchmark'] }) {
  const range = benchmark.max - benchmark.min
  const pct = Math.max(0, Math.min(100, ((value - benchmark.min) / range) * 100))
  const sectorPct = ((benchmark.sector - benchmark.min) / range) * 100
  return (
    <div className="relative h-3 bg-muted rounded-full overflow-hidden mt-2">
      {/* Gradient: green zone vs red zone depending on direction */}
      <div className="absolute inset-0 rounded-full" style={{
        background: benchmark.good === 'above'
          ? `linear-gradient(to right, hsl(var(--destructive) / 0.3), hsl(var(--warning) / 0.3) ${sectorPct * 0.7}%, hsl(var(--success) / 0.3) ${sectorPct}%, hsl(var(--success) / 0.3))`
          : `linear-gradient(to right, hsl(var(--success) / 0.3), hsl(var(--success) / 0.3) ${sectorPct}%, hsl(var(--warning) / 0.3) ${sectorPct * 1.3}%, hsl(var(--destructive) / 0.3))`,
      }} />
      {/* Sector marker */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/40" style={{ left: `${sectorPct}%` }} />
      {/* Value indicator */}
      <div
        className="absolute top-0 bottom-0 w-2.5 h-2.5 rounded-full border-2 border-card bg-foreground"
        style={{ left: `calc(${pct}% - 5px)`, top: '0.5px' }}
      />
    </div>
  )
}

export default function RatiosPage() {
  const t = useTranslations('ratios')
  const { data, error, isLoading, mutate } = useRatios()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const hydrated = useHydrated()

  if (!hydrated || isLoading || !data) return <SkeletonKPIsAndTable cols={4} rows={6} />

  const { ratios, history } = data as { ratios: Ratio[]; history: any[] }
  const filtered = activeCategory === 'ALL' ? ratios : ratios.filter(r => r.category === activeCategory)

  // Summary counts
  const healthy = ratios.filter(r => getSignalKey(r) === 'healthy').length
  const warning = ratios.filter(r => getSignalKey(r) === 'warning').length
  const critical = ratios.filter(r => getSignalKey(r) === 'critical').length

  // History chart keys
  const historyKeys = [
    { key: 'current_ratio', label: t('historyCurrentRatio'), color: 'hsl(var(--primary))' },
    { key: 'roe', label: t('historyRoe'), color: 'hsl(var(--success))' },
    { key: 'debt_equity', label: t('historyDebtEquity'), color: 'hsl(var(--warning))' },
    { key: 'ebitda_margin', label: t('historyEbitdaMargin'), color: 'hsl(var(--destructive))' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={() => mutate()}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiBox index={0} label={t('healthy')} value={String(healthy)} icon={<CheckCircle2 size={16} />} color="text-success" />
        <KpiBox index={1} label={t('attention')} value={String(warning)} icon={<AlertTriangle size={16} />} color="text-warning" />
        <KpiBox index={2} label={t('criticals')} value={String(critical)} icon={<XCircle size={16} />} color="text-destructive" />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto">
        <button onClick={() => setActiveCategory('ALL')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeCategory === 'ALL' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
          {t('all', { count: ratios.length })}
        </button>
        {Object.entries(CATEGORY_KEYS).map(([key, tKey]) => {
          const count = ratios.filter(r => r.category === key).length
          return (
            <button key={key} onClick={() => setActiveCategory(key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeCategory === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {t(tKey)} ({count})
            </button>
          )
        })}
      </div>

      {/* Ratio cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(ratio => {
          const signalKey = getSignalKey(ratio)
          const signalColor = getSignalColor(signalKey)
          const signalIcon = getSignalIcon(signalKey)
          const signalLabel = signalKey === 'healthy' ? t('healthy') : signalKey === 'warning' ? t('attention') : t('criticals')
          const isExpanded = expandedId === ratio.id
          return (
            <Card key={ratio.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setExpandedId(isExpanded ? null : ratio.id)}>
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{ratio.name}</span>
                      <Badge variant="outline" className="text-[9px]">{CATEGORY_KEYS[ratio.category] ? t(CATEGORY_KEYS[ratio.category]) : ratio.category}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{ratio.formula}</div>
                  </div>
                  <div className={`flex items-center gap-1 ${signalColor}`}>
                    {signalIcon}
                  </div>
                </div>

                {/* Value */}
                <div className="flex items-end gap-2 mb-1">
                  <span className={`font-mono text-2xl font-bold ${signalColor}`}>{fmtRatio(ratio.value, ratio.unit)}</span>
                  <span className="text-xs text-muted-foreground mb-1">{t('sector')}: {fmtRatio(ratio.benchmark.sector, ratio.unit)}</span>
                </div>

                {/* Gauge */}
                <GaugeBar value={ratio.unit === '%' ? ratio.value : ratio.value} benchmark={ratio.benchmark} />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>{fmtRatio(ratio.benchmark.min, ratio.unit)}</span>
                  <span>{fmtRatio(ratio.benchmark.max, ratio.unit)}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div className="text-xs text-muted-foreground">{ratio.description}</div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-2">{t('components')}</div>
                    {Object.entries(ratio.components).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-mono font-semibold">{fmtEur(Math.round(val))}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-muted/50 text-[10px]">
                      <span className={`flex items-center gap-1 font-semibold ${signalColor}`}>{signalIcon} {signalLabel}</span>
                      <span className="text-muted-foreground">
                        {ratio.benchmark.good === 'above' ? t('targetAbove', { value: fmtRatio(ratio.benchmark.sector, ratio.unit) }) : t('targetBelow', { value: fmtRatio(ratio.benchmark.sector, ratio.unit) })}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Historical evolution */}
      <Card>
        <CardHeader><CardTitle>{t('quarterlyEvolution')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {historyKeys.map(hk => (
              <div key={hk.key}>
                <div className="text-xs font-semibold text-muted-foreground mb-2">{hk.label}</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={history} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
                    <RTooltip
                       
                      formatter={(v: number) => [fmt(v, 2), hk.label]}
                    />
                    <Line type="monotone" dataKey={hk.key} stroke={hk.color} strokeWidth={2} dot={{ r: 4, fill: hk.color }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
