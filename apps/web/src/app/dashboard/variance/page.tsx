'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtM, fmt, fmtPct, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Download, CheckCircle2, AlertTriangle } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonVariance } from '@/components/ui/skeleton-page'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { useTranslations } from 'next-intl'

function varianceAbs(actual: number, ref: number) { return actual - ref }
function variancePct(actual: number, ref: number) { return ref !== 0 ? ((actual - ref) / Math.abs(ref)) * 100 : 0 }

// For costs/expenses: positive variance (actual > budget) is bad. For revenue/margin/ebitda/cash: positive is good.
const costRows = new Set(['COGS', 'Gastos Personal'])
function isGood(category: string, diff: number) {
  return costRows.has(category) ? diff <= 0 : diff >= 0
}

export default function VariancePage() {
  const t = useTranslations('variance')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [compareMode, setCompareMode] = useState<'budget' | 'yoy'>('budget')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  function fetchData() {
    setLoading(true)
    return api.scenarios.variance()
      .then(setData)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => { fetchData() }, [])

  async function refresh() {
    await fetchData()
  }

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonVariance />
  if (!data) return <div className="text-center text-muted-foreground py-20">{t('errorLoading')}</div>

  const { categories, actual, budget, prevYear } = data
  const ref = compareMode === 'budget' ? budget : prevYear
  const refLabel = compareMode === 'budget' ? 'Budget' : 'YoY (2025)'

  // Build rows
  const rows = categories.map((cat: string, i: number) => {
    const act = actual[i]
    const rv = ref[i]
    const bv = budget[i]
    const pv = prevYear[i]
    const diffBudget = varianceAbs(act, bv)
    const pctBudget = variancePct(act, bv)
    const diffYoy = varianceAbs(act, pv)
    const pctYoy = variancePct(act, pv)
    return { category: cat, actual: act, budget: bv, prevYear: pv, ref: rv, diffBudget, pctBudget, diffYoy, pctYoy }
  })

  // Chart data
  const chartData = rows.map((r: any) => ({
    name: r.category,
    Actual: r.actual / 1000,
    [refLabel]: r.ref / 1000,
  }))

  // Waterfall data for variances
  const waterfallData = rows.map((r: any) => {
    const diff = compareMode === 'budget' ? r.diffBudget : r.diffYoy
    return {
      name: r.category,
      varianza: diff / 1000,
      fill: isGood(r.category, diff) ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
    }
  })

  // Summary KPIs
  const revenueRow = rows[0]
  const ebitdaRow = rows.find((r: any) => r.category === 'EBITDA')
  const cashRow = rows.find((r: any) => r.category === 'Tesorería')
  const totalFavorable = rows.filter((r: any) => {
    const diff = compareMode === 'budget' ? r.diffBudget : r.diffYoy
    return isGood(r.category, diff)
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { mode: compareMode === 'budget' ? t('modeBudget') : t('modePrevYear') })}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <div className="flex bg-muted rounded-lg p-0.5">
              {(['budget', 'yoy'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setCompareMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${compareMode === mode ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {mode === 'budget' ? t('vsBudget') : t('vsYoy')}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV('variance_analysis', [t('colConcept'), t('colActual2026'), t('colBudget2026'), t('colVarBudget'), t('colPctBudget'), t('colActual2025'), t('colVarYoy'), t('colPctYoy')], rows.map((r: any) => [r.category, r.actual, r.budget, r.diffBudget, `${r.pctBudget.toFixed(1)}%`, r.prevYear, r.diffYoy, `${r.pctYoy.toFixed(1)}%`]))}><Download size={14} className="mr-1" />{t('export')}</Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t('revenueVs', { ref: refLabel }),
            value: `${revenueRow.pctBudget > 0 && compareMode === 'budget' ? '+' : ''}${fmtPct(compareMode === 'budget' ? revenueRow.pctBudget : revenueRow.pctYoy)}`,
            good: isGood('Revenue', compareMode === 'budget' ? revenueRow.diffBudget : revenueRow.diffYoy),
          },
          {
            label: t('ebitdaVs', { ref: refLabel }),
            value: `${(compareMode === 'budget' ? ebitdaRow.pctBudget : ebitdaRow.pctYoy) > 0 ? '+' : ''}${fmtPct(compareMode === 'budget' ? ebitdaRow.pctBudget : ebitdaRow.pctYoy)}`,
            good: isGood('EBITDA', compareMode === 'budget' ? ebitdaRow.diffBudget : ebitdaRow.diffYoy),
          },
          {
            label: t('treasuryVs', { ref: refLabel }),
            value: `${(compareMode === 'budget' ? cashRow.pctBudget : cashRow.pctYoy) > 0 ? '+' : ''}${fmtPct(compareMode === 'budget' ? cashRow.pctBudget : cashRow.pctYoy)}`,
            good: isGood('Tesorería', compareMode === 'budget' ? cashRow.diffBudget : cashRow.diffYoy),
          },
          {
            label: t('favorableLines'),
            value: `${totalFavorable}/${categories.length}`,
            good: totalFavorable >= categories.length / 2,
          },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} color={m.good ? 'text-success' : 'text-destructive'} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Grouped bar chart */}
        <Card>
          <CardHeader><CardTitle>{t('chartActualVsRef', { ref: refLabel })}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}k`} />
                <Tooltip formatter={(v: any) => fmtEur(Number(v) * 1000)} />
                <Legend />
                <Bar dataKey="Actual" fill="hsl(var(--primary))" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                <Bar dataKey={refLabel} fill="hsl(var(--muted-foreground))" fillOpacity={0.4} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Variance bars */}
        <Card>
          <CardHeader><CardTitle>{t('chartVarianceVsRef', { ref: refLabel })}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}k`} />
                <Tooltip formatter={(v: any) => [`${Number(v) > 0 ? '+' : ''}${fmtEur(Number(v) * 1000)}`, t('varianceLabel')]} />
                <Bar dataKey="varianza" radius={[3, 3, 0, 0]}>
                  {waterfallData.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.fill} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed table */}
      <Card>
        <CardHeader><CardTitle>{t('varianceDetail')}</CardTitle></CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[t('colConcept'), t('colActual2026'), t('colBudget2026'), t('colVarBudget'), t('colPctBudget'), t('colActual2025'), t('colVarYoy'), t('colPctYoy')].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const goodBudget = isGood(r.category, r.diffBudget)
                const goodYoy = isGood(r.category, r.diffYoy)
                const isTotal = r.category === 'Margen Bruto' || r.category === 'EBITDA'
                return (
                  <tr key={r.category} className={`border-b border-border hover:bg-muted/50 transition-colors ${isTotal ? 'bg-muted/30 font-semibold' : ''}`}>
                    <td className="p-3">
                      <span className={isTotal ? 'font-semibold' : ''}>{r.category}</span>
                    </td>
                    <td className={`p-3 font-mono text-xs font-semibold ${r.actual >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtEur(r.actual)}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(r.budget)}</td>
                    <td className="p-3">
                      <span className={`font-mono text-xs font-semibold ${goodBudget ? 'text-success' : 'text-destructive'}`}>
                        {r.diffBudget > 0 ? '+' : ''}{fmtEur(r.diffBudget)}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant={goodBudget ? 'success' : 'destructive'}>
                        {r.pctBudget > 0 ? '+' : ''}{fmtPct(r.pctBudget)}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(r.prevYear)}</td>
                    <td className="p-3">
                      <span className={`font-mono text-xs font-semibold ${goodYoy ? 'text-success' : 'text-destructive'}`}>
                        {r.diffYoy > 0 ? '+' : ''}{fmtEur(r.diffYoy)}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant={goodYoy ? 'success' : 'destructive'}>
                        {r.pctYoy > 0 ? '+' : ''}{fmtPct(r.pctYoy)}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
</ScrollableTable>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader><CardTitle>{t('deviationAnalysis')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r: any) => {
            const diff = compareMode === 'budget' ? r.diffBudget : r.diffYoy
            const pct = compareMode === 'budget' ? r.pctBudget : r.pctYoy
            const good = isGood(r.category, diff)
            if (Math.abs(pct) < 1) return null
            return (
              <div key={r.category} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0">{good ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />}</span>
                <div>
                  <span className="font-medium">{r.category}:</span>
                  <span className="text-muted-foreground">
                    {' '}{good ? t('favorable') : t('unfavorable')} {t('insightBy', { amount: fmtEur(Math.abs(diff)), pct: `${pct > 0 ? '+' : ''}${fmtPct(pct)}`, ref: refLabel })}
                    {r.category === 'Revenue' && good && ` ${t('insightRevenueGood')}`}
                    {r.category === 'COGS' && !good && ` ${t('insightCogsBad')}`}
                    {r.category === 'COGS' && good && ` ${t('insightCogsGood')}`}
                    {r.category === 'Gastos Personal' && !good && ` ${t('insightPersonnelBad')}`}
                    {r.category === 'EBITDA' && good && ` ${t('insightEbitdaGood')}`}
                    {r.category === 'Tesorería' && good && ` ${t('insightTreasuryGood')}`}
                  </span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
