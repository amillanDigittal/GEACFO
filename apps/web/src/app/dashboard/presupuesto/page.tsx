'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { useHydrated } from '@/hooks/use-hydrated'
import { fmtEur, fmtPct } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Save, PlayCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { SkeletonPresupuesto } from '@/components/ui/skeleton-page'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTranslations } from 'next-intl'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const CATEGORIES = ['Revenue', 'COGS', 'Gastos Personal', 'Marketing', 'Otros Gastos', 'Amortización']
const COST_CATS = new Set(['COGS', 'Gastos Personal', 'Marketing', 'Otros Gastos', 'Amortización'])

function round2(n: number) { return Math.round(n * 100) / 100 }

export default function PresupuestoPage() {
  const t = useTranslations('presupuesto')
  const [year, setYear] = useState(new Date().getFullYear())
  const [grid, setGrid] = useState<Record<string, Record<number, number>>>({})
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [variance, setVariance] = useState<any>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const CATEGORY_LABELS: Record<string, string> = {
    'Revenue': t('catRevenue'),
    'COGS': t('catCogs'),
    'Gastos Personal': t('catPersonnel'),
    'Marketing': t('catMarketing'),
    'Otros Gastos': t('catOtherExpenses'),
    'Amortización': t('catDepreciation'),
  }

  const { confirmLeave } = useUnsavedChanges(dirty)

  function changeYear(delta: number) {
    if (!confirmLeave()) return
    setYear(y => y + delta)
  }

  const loadBudget = useCallback(async () => {
    setLoading(true)
    try {
      const [budgetData, varianceData] = await Promise.all([
        api.budget.get(year),
        api.budget.variance(year),
      ])
      // Build grid from lines
      const g: Record<string, Record<number, number>> = {}
      for (const cat of CATEGORIES) {
        g[cat] = {}
        for (let m = 1; m <= 12; m++) g[cat][m] = 0
      }
      for (const l of budgetData.lines) {
        if (g[l.category]) g[l.category][l.month] = Number(l.amount)
      }
      setGrid(g)
      setVariance(varianceData)
      setDirty(false)
    } catch (err) { console.error(err) }
    finally { setLoading(false); setLastUpdated(new Date()) }
  }, [year])

  useEffect(() => { loadBudget() }, [loadBudget])

  async function refresh() { await loadBudget() }

  async function initDefaults() {
    try {
      await api.budget.init(year)
      await loadBudget()
    } catch (err) { console.error(err) }
  }

  function updateCell(cat: string, month: number, value: string) {
    const num = parseFloat(value) || 0
    setGrid(prev => ({
      ...prev,
      [cat]: { ...prev[cat], [month]: round2(num) },
    }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const lines: { month: number; category: string; amount: number }[] = []
      for (const cat of CATEGORIES) {
        for (let m = 1; m <= 12; m++) {
          lines.push({ month: m, category: cat, amount: grid[cat]?.[m] || 0 })
        }
      }
      await api.budget.upsertLines(year, lines)
      setDirty(false)
      // Reload variance with new budget
      const varianceData = await api.budget.variance(year)
      setVariance(varianceData)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonPresupuesto />

  const hasData = Object.values(grid).some(months => Object.values(months).some(v => v > 0))

  // Compute totals
  const annualByCategory: Record<string, number> = {}
  for (const cat of CATEGORIES) {
    annualByCategory[cat] = Object.values(grid[cat] || {}).reduce((s, v) => s + v, 0)
  }
  const totalRevenue = annualByCategory['Revenue'] || 0
  const totalCosts = CATEGORIES.filter(c => COST_CATS.has(c)).reduce((s, c) => s + (annualByCategory[c] || 0), 0)
  const totalEBITDA = totalRevenue - totalCosts
  const ebitdaMargin = totalRevenue > 0 ? (totalEBITDA / totalRevenue) * 100 : 0

  // Chart: monthly revenue budget vs actual
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const budRev = grid['Revenue']?.[m] || 0
    const actRev = variance?.monthly?.find((r: any) => r.month === m)?.revenue?.actual || 0
    return { name: MONTH_NAMES[i], presupuesto: budRev, real: m <= (variance?.currentMonth || 0) ? actRev : null }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { year })}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button onClick={() => changeYear(-1)} className="p-1.5 rounded-md hover:bg-background transition-colors"><ChevronLeft size={14} /></button>
              <span className="px-2 text-sm font-mono font-semibold">{year}</span>
              <button onClick={() => changeYear(1)} className="p-1.5 rounded-md hover:bg-background transition-colors"><ChevronRight size={14} /></button>
            </div>
            {dirty && (
              <Button variant="default" size="sm" onClick={save} disabled={saving}>
                <Save size={14} className="mr-1" />
                {saving ? t('saving') : t('save')}
              </Button>
            )}
          </div>
        }
      />

      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="text-muted-foreground mb-4">{t('noBudget', { year })}</div>
            <Button onClick={initDefaults}>
              <PlayCircle size={14} className="mr-1" />
              {t('createBaseBudget')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('kpiAnnualRevenue'), value: fmtEur(totalRevenue) },
              { label: t('kpiTotalCosts'), value: fmtEur(totalCosts), color: 'text-destructive' },
              { label: t('kpiBudgetedEbitda'), value: fmtEur(totalEBITDA), color: totalEBITDA > 0 ? 'text-success' : 'text-destructive' },
              { label: t('kpiEbitdaMargin'), value: fmtPct(ebitdaMargin), color: ebitdaMargin > 20 ? 'text-success' : 'text-warning' },
            ].map((m, i) => (
              <KpiBox key={m.label} index={i} label={m.label} value={m.value} color={m.color || 'text-foreground'} />
            ))}
          </div>

          {/* Budget Grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('monthlyBudget', { year })}</CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {dirty ? t('unsaved') : t('saved')}
                </Badge>
              </div>
            </CardHeader>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider sticky left-0 bg-card z-10 min-w-[160px]">{t('colConcept')}</th>
                    {MONTH_NAMES.map(m => (
                      <th key={m} className="text-center p-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider min-w-[100px]">{m}</th>
                    ))}
                    <th className="text-center p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider bg-muted/50 min-w-[120px]">{t('colAnnualTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(cat => {
                    const isCost = COST_CATS.has(cat)
                    return (
                      <tr key={cat} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-xs whitespace-nowrap sticky left-0 bg-card z-10">
                          {CATEGORY_LABELS[cat]}
                          {isCost && <span className="text-muted-foreground ml-1 text-[10px]">({t('costLabel')})</span>}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <td key={m} className="p-1 text-center">
                            <input
                              type="number"
                              value={grid[cat]?.[m] || ''}
                              onChange={e => updateCell(cat, m, e.target.value)}
                              className="w-full bg-transparent border border-border/50 rounded px-2 py-1.5 text-xs font-mono text-center hover:border-border"
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="p-3 text-center bg-muted/50 font-mono text-xs font-semibold">
                          {fmtEur(annualByCategory[cat] || 0)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Computed rows */}
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="p-3 text-xs sticky left-0 bg-muted/30 z-10">{t('grossMargin')}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const rev = grid['Revenue']?.[m] || 0
                      const cogs = grid['COGS']?.[m] || 0
                      const margin = rev - cogs
                      return <td key={m} className="p-3 text-center font-mono text-xs">{fmtEur(margin)}</td>
                    })}
                    <td className="p-3 text-center bg-muted/50 font-mono text-xs font-bold">{fmtEur(totalRevenue - (annualByCategory['COGS'] || 0))}</td>
                  </tr>
                  <tr className="bg-primary/5 font-bold">
                    <td className="p-3 text-xs sticky left-0 bg-primary/5 z-10">EBITDA</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const rev = grid['Revenue']?.[m] || 0
                      const costs = CATEGORIES.filter(c => COST_CATS.has(c)).reduce((s, c) => s + (grid[c]?.[m] || 0), 0)
                      const ebitda = rev - costs
                      return (
                        <td key={m} className={`p-3 text-center font-mono text-xs ${ebitda >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {fmtEur(ebitda)}
                        </td>
                      )
                    })}
                    <td className={`p-3 text-center bg-muted/50 font-mono text-xs font-bold ${totalEBITDA >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmtEur(totalEBITDA)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollableTable>
          </Card>

          {/* Chart: Budget vs Real */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>{t('revenueBudgetVsActual', { year })}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(v: any, name: string) => [v != null ? fmtEur(v) : '—', name === 'presupuesto' ? t('legendBudget') : t('legendActual')]}
                       
                    />
                    <Legend formatter={(value: string) => value === 'presupuesto' ? t('legendBudget') : t('legendActual')} />
                    <Bar dataKey="presupuesto" fill="hsl(var(--muted-foreground))" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('monthlyBudgetedEbitda')}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={Array.from({ length: 12 }, (_, i) => {
                    const m = i + 1
                    const rev = grid['Revenue']?.[m] || 0
                    const costs = CATEGORIES.filter(c => COST_CATS.has(c)).reduce((s, c) => s + (grid[c]?.[m] || 0), 0)
                    return { name: MONTH_NAMES[i], ebitda: rev - costs }
                  })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(v: any) => [fmtEur(v), 'EBITDA']}
                       
                    />
                    <Bar dataKey="ebitda" radius={[4, 4, 0, 0]}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1
                        const rev = grid['Revenue']?.[m] || 0
                        const costs = CATEGORIES.filter(c => COST_CATS.has(c)).reduce((s, c) => s + (grid[c]?.[m] || 0), 0)
                        const ebitda = rev - costs
                        return <rect key={i} fill={ebitda >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Variance Summary */}
          {variance && variance.budget && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('varianceTitle')}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dashboard/variance'} className="text-xs">
                    {t('viewFullVariance')}
                  </Button>
                </div>
              </CardHeader>
              <ScrollableTable>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {[t('varColConcept'), t('varColActualYtd'), t('varColBudgetYtd'), t('varColVariance'), '%'].map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variance.categories.map((cat: string, i: number) => {
                      const act = variance.actual[i]
                      const bud = variance.budget[i]
                      const diff = act - bud
                      const pct = bud !== 0 ? ((act - bud) / Math.abs(bud)) * 100 : 0
                      const isCost = cat === 'COGS' || cat === 'Gastos Personal'
                      const good = isCost ? diff <= 0 : diff >= 0
                      const isSubtotal = cat === 'Margen Bruto' || cat === 'EBITDA'
                      return (
                        <tr key={cat} className={`border-b border-border hover:bg-muted/50 ${isSubtotal ? 'bg-muted/30 font-semibold' : ''}`}>
                          <td className="p-3 text-xs">{cat}</td>
                          <td className="p-3 font-mono text-xs font-semibold">{fmtEur(act)}</td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(bud)}</td>
                          <td className="p-3">
                            <span className={`font-mono text-xs font-semibold ${good ? 'text-success' : 'text-destructive'}`}>
                              {diff > 0 ? '+' : ''}{fmtEur(diff)}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge variant={good ? 'success' : 'destructive'}>
                              {pct > 0 ? '+' : ''}{fmtPct(pct)}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
