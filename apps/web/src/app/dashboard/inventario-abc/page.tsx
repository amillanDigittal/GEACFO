'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { fmtEur, fmt, fmtPct, exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonInventarioABC } from '@/components/ui/skeleton-page'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import { Download, Package, AlertTriangle, TrendingUp, ShoppingCart } from 'lucide-react'

export default function AbcPage() {
  const t = useTranslations('inventarioAbc')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<string>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const ABC_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
    A: { label: t('classA'), color: 'hsl(var(--primary))', bg: 'bg-primary/10', border: 'border-primary/20', desc: t('classADesc') },
    B: { label: t('classB'), color: 'hsl(var(--warning))', bg: 'bg-warning/10', border: 'border-warning/20', desc: t('classBDesc') },
    C: { label: t('classC'), color: 'hsl(var(--muted-foreground))', bg: 'bg-muted/50', border: 'border-border', desc: t('classCDesc') },
  }

  function fetchData() {
    return api.inventory.abc()
      .then(d => { setData(d); setLastUpdated(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleRefresh() {
    await fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [])

  const hydrated = useHydrated()

  if (!hydrated || loading || !data) return <SkeletonInventarioABC />

  const { items, summary, totalValue } = data
  const filtered = filterCat === 'ALL' ? items : items.filter((i: any) => i.category === filterCat)

  // Pareto chart data
  const paretoData = items.map((i: any, idx: number) => ({
    name: i.sku,
    value: Math.round(i.totalValue),
    cumPct: Math.round(i.cumPct * 10) / 10,
    category: i.category,
  }))

  // Summary bar data
  const summaryBars = [
    { name: 'A', items: summary.A.count, value: summary.A.value, pct: summary.A.pct },
    { name: 'B', items: summary.B.count, value: summary.B.value, pct: summary.B.pct },
    { name: 'C', items: summary.C.count, value: summary.C.value, pct: summary.C.pct },
  ]

  // Items needing reorder
  const reorderUrgent = items.filter((i: any) => i.reorderRecommendation.startsWith('Urgente'))
  const reorderNeeded = items.filter((i: any) => i.reorderRecommendation.startsWith('Reponer'))

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: items.length, totalValue: fmtEur(totalValue) })}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV('inventario_abc',
            [t('thSku'), t('thDescription'), t('thClass'), t('thStock'), t('thUnitCost'), t('thTotalValue'), t('thValuePct'), t('thCumPct'), t('thRotation'), t('thSafetyStock'), t('thReorderPoint'), t('thRecommendation')],
            items.map((i: any) => [i.sku, i.description, i.category, i.stock, i.unitCost, i.totalValue, i.valuePct.toFixed(1), i.cumPct.toFixed(1), i.rotationDays, i.safetyStock, i.reorderPoint, i.reorderRecommendation])
          )}><Download size={14} className="mr-1" />{t('export')}</Button>
        }
      />

      {/* Reorder alerts */}
      {(reorderUrgent.length > 0 || reorderNeeded.length > 0) && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <ShoppingCart size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            {reorderUrgent.length > 0 && (
              <div className="font-semibold text-sm">{t('alertUrgentReorder', { count: reorderUrgent.length })}</div>
            )}
            {reorderNeeded.length > 0 && (
              <div className="text-xs opacity-80 mt-0.5">{t('alertReorderNeeded', { count: reorderNeeded.length })}</div>
            )}
          </div>
        </div>
      )}

      {/* ABC Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as const).map(cat => {
          const cfg = ABC_CONFIG[cat]
          const s = summary[cat]
          return (
            <div key={cat} className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg text-white" style={{ background: cfg.color }}>{cat}</div>
                  <div>
                    <div className="text-sm font-semibold">{cfg.label}</div>
                    <div className="text-[10px] text-muted-foreground">{cfg.desc}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Items</div>
                  <div className="font-mono text-lg font-bold">{s.count}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">{t('labelValue')}</div>
                  <div className="font-mono text-lg font-bold">{fmtEur(Math.round(s.value))}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">{t('labelPctTotal')}</div>
                  <div className="font-mono text-lg font-bold">{fmtPct(s.pct)}</div>
                </div>
              </div>
              {/* Value bar */}
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: cfg.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pareto chart */}
        <Card>
          <CardHeader><CardTitle>{t('paretoChart')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={paretoData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--card-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                        labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                  formatter={(v: number, name: string) => [name === 'cumPct' ? `${v}%` : fmtEur(v), name === 'cumPct' ? t('tooltipCumPct') : t('tooltipValue')]}
                />
                <Bar yAxisId="left" dataKey="value" radius={[3, 3, 0, 0]}>
                  {paretoData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={ABC_CONFIG[entry.category]?.color || 'hsl(var(--muted))'} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card>
          <CardHeader><CardTitle>{t('categoryDistribution')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summaryBars} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => fmtEur(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 14, fontWeight: 'bold', fill: 'hsl(var(--foreground))' }} width={30} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--card-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                        labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                  formatter={(v: number) => [fmtEur(v), t('tooltipValue')]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {summaryBars.map((entry, idx) => (
                    <Cell key={idx} fill={ABC_CONFIG[entry.name]?.color || 'hsl(var(--muted))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {summaryBars.map(b => (
                <div key={b.name} className="flex items-center gap-3 text-xs">
                  <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-white text-xs" style={{ background: ABC_CONFIG[b.name]?.color }}>{b.name}</div>
                  <span className="flex-1 text-muted-foreground">{t('categoryLine', { items: b.items, pct: fmtPct(b.pct) })}</span>
                  <span className="font-mono font-semibold">{fmtEur(Math.round(b.value))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t('classificationDetail')}</CardTitle>
            <div className="flex gap-1">
              {['ALL', 'A', 'B', 'C'].map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterCat === c ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {c === 'ALL' ? t('filterAll') : t('filterClass', { class: c })}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[t('thClass'), t('thSku'), t('thDescription'), t('thStock'), t('thTotalValue'), t('thValuePct'), t('thCumPct'), t('thRotation'), t('thRecommendation')].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const cfg = ABC_CONFIG[item.category]
                const isExpanded = expandedId === item.id
                return (
                  <>
                    <tr
                      key={item.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <td className="p-3">
                        <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-sm text-white" style={{ background: cfg?.color }}>{item.category}</div>
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold">{item.sku}</td>
                      <td className="p-3 text-xs">{item.description}</td>
                      <td className="p-3 font-mono text-xs">{fmt(item.stock)}</td>
                      <td className="p-3 font-mono text-xs font-semibold">{fmtEur(item.totalValue)}</td>
                      <td className="p-3 font-mono text-xs">{fmtPct(item.valuePct)}</td>
                      <td className="p-3 font-mono text-xs">{fmtPct(item.cumPct)}</td>
                      <td className="p-3">
                        <span className={`font-mono text-xs ${item.rotationDays >= 120 ? 'text-destructive' : item.rotationDays >= 60 ? 'text-warning' : 'text-success'}`}>
                          {item.rotationDays}d
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs ${item.reorderRecommendation.startsWith('Urgente') ? 'text-destructive font-semibold' : item.reorderRecommendation.startsWith('Reponer') ? 'text-warning font-semibold' : item.reorderRecommendation.startsWith('Liquidar') ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {item.reorderRecommendation.split(' — ')[0]}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.id}-detail`} className="border-b border-border">
                        <td colSpan={9} className="p-4 bg-muted/30">
                          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-muted-foreground uppercase">{t('detailUnitCost')}</div>
                              <div className="font-mono text-sm font-bold">{fmtEur(item.unitCost)}</div>
                            </div>
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-muted-foreground uppercase">{t('detailDailyUsage')}</div>
                              <div className="font-mono text-sm font-bold">{fmt(item.dailyUsage, 1)} {t('units')}</div>
                            </div>
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-muted-foreground uppercase">{t('detailSafetyStock')}</div>
                              <div className="font-mono text-sm font-bold">{fmt(item.safetyStock)} {t('units')}</div>
                            </div>
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-muted-foreground uppercase">{t('detailReorderPoint')}</div>
                              <div className="font-mono text-sm font-bold">{fmt(item.reorderPoint)} {t('units')}</div>
                            </div>
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-muted-foreground uppercase">{t('detailCoverage')}</div>
                              <div className="font-mono text-sm font-bold">{item.coverageDays}d ({fmt(item.coverageDays / 7, 1)} {t('weeks')})</div>
                            </div>
                          </div>
                          <div className={`mt-3 p-3 rounded-lg text-xs ${item.reorderRecommendation.startsWith('Urgente') ? 'bg-destructive/10 border border-destructive/20 text-destructive' : item.reorderRecommendation.startsWith('Reponer') ? 'bg-warning/10 border border-warning/20 text-warning' : 'bg-muted/50 border border-border text-muted-foreground'}`}>
                            <strong>{t('recommendation')}:</strong> {item.reorderRecommendation}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>
    </div>
  )
}
