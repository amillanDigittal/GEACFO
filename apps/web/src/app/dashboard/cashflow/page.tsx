'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Download, TrendingUp, TrendingDown, ArrowRight, Banknote, Factory, Building2, Landmark, Wand2, FileDown } from 'lucide-react'
import { exportCashFlowPDF } from '@/lib/export-pdf-modules'
import { DateRangeSelector, type DateRange, compareValues } from '@/components/date-range-selector'
import { useTranslations } from 'next-intl'

export default function CashFlowPage() {
  const t = useTranslations('cashflow')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [detailSection, setDetailSection] = useState<'operating' | 'investing' | 'financing'>('operating')
  const [movPage, setMovPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [catStats, setCatStats] = useState<any>(null)
  const [recategorizing, setRecategorizing] = useState(false)
  const [prevData, setPrevData] = useState<any>(null)
  const [periodLabel, setPeriodLabel] = useState<{ current: string; previous: string } | null>(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const CATEGORY_LABELS: Record<string, string> = {
    COBRO: t('categoryCustomerCollections'),
    PAGO_PROV: t('categorySupplierPayments'),
    NOMINA: t('categoryPayroll'),
    SS: t('categorySocialSecurity'),
    IMPUESTO: t('categoryTaxes'),
    SUMINISTRO: t('categoryUtilities'),
    ALQUILER: t('categoryRent'),
    SEGURO: t('categoryInsurance'),
    COMISION: t('categoryBankFees'),
    DEVOLUCION: t('categoryReturns'),
    MANT: t('categoryMaintenance'),
    LEASING: t('categoryLeasing'),
    TRANSFER: t('categoryInternalTransfers'),
    OTHER: t('categoryOther'),
  }

  const FLOW_TYPE_CONFIG = {
    operating: { label: t('flowOperating'), icon: <Factory size={18} />, color: 'hsl(var(--primary))' },
    investing: { label: t('flowInvesting'), icon: <Building2 size={18} />, color: 'hsl(var(--warning))' },
    financing: { label: t('flowFinancing'), icon: <Landmark size={18} />, color: 'hsl(var(--success))' },
  }

  function fetchData() {
    return Promise.all([
      api.treasury.cashflow(dateFrom, dateTo),
      api.treasury.categories().catch(() => null),
    ])
      .then(([d, cats]) => { setData(d); setCatStats(cats); setLastUpdated(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleDateRange(current: DateRange, previous: DateRange | null) {
    setLoading(true)
    try {
      const from = current.from || undefined, to = current.to || undefined
      setDateFrom(from); setDateTo(to)
      const [d, cats] = await Promise.all([api.treasury.cashflow(from, to), api.treasury.categories().catch(() => null)])
      setData(d); setCatStats(cats)
      if (previous?.from) {
        const prev = await api.treasury.cashflow(previous.from, previous.to)
        setPrevData(prev)
        setPeriodLabel({ current: current.label, previous: previous.label })
      } else { setPrevData(null); setPeriodLabel(null) }
    } catch (err) { console.error(err) }
    finally { setLoading(false); setLastUpdated(new Date()) }
  }

  async function handleRefresh() {
    await fetchData()
  }

  async function handleRecategorize() {
    setRecategorizing(true)
    try {
      await api.treasury.recategorize()
      await fetchData()
    } catch (e) { console.error(e) }
    finally { setRecategorizing(false) }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const hydrated = useHydrated()

  if (!hydrated || loading || !data) return <SkeletonKPIsAndTable cols={6} rows={8} />

  const { months, categoryBreakdown, totals, recentMovements } = data

  // Chart data
  const chartData = months.map((m: any) => ({
    month: m.month.slice(2).replace('-', '/'),
    [t('flowOperating')]: Math.round(m.operating),
    [t('flowInvesting')]: Math.round(m.investing),
    [t('flowFinancing')]: Math.round(m.financing),
    [t('chartNet')]: Math.round(m.operating + m.investing + m.financing),
  }))

  // Category details grouped by flow type
  const categories = Object.entries(categoryBreakdown as Record<string, { amount: number; count: number; type: string }>)
    .sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))

  const operatingCats = categories.filter(([_, v]) => v.type === 'operating')
  const investingCats = categories.filter(([_, v]) => v.type === 'investing')
  const financingCats = categories.filter(([_, v]) => v.type === 'financing')

  const detailCats = detailSection === 'operating' ? operatingCats : detailSection === 'investing' ? investingCats : financingCats

  // Inflows vs outflows for operating
  const operatingInflows = operatingCats.filter(([_, v]) => v.amount > 0).reduce((s, [_, v]) => s + v.amount, 0)
  const operatingOutflows = operatingCats.filter(([_, v]) => v.amount < 0).reduce((s, [_, v]) => s + v.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: data.movementCount })}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        actions={
          <div className="flex gap-2">
            <DateRangeSelector onChange={handleDateRange} />
            {catStats && catStats.uncategorized > 0 && (
              <Button variant="outline" size="sm" onClick={handleRecategorize} disabled={recategorizing}>
                <Wand2 size={14} className="mr-1" />
                {recategorizing ? t('categorizing') : t('autoClassify', { count: catStats.uncategorized })}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => exportCashFlowPDF(data)}><FileDown size={14} className="mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV('cash_flow_statement',
              [t('columnCategory'), t('columnType'), t('columnAmount'), t('columnMovements')],
              categories.map(([cat, v]) => [CATEGORY_LABELS[cat] || cat, v.type, v.amount, v.count])
            )}><Download size={14} className="mr-1" />{t('export')}</Button>
          </div>
        }
      />

      {/* Period comparison */}
      {prevData && periodLabel && (() => {
        const items = [
          { label: t('compOperating'), cur: totals.operating, prev: prevData.totals.operating },
          { label: t('compInvesting'), cur: totals.investing, prev: prevData.totals.investing },
          { label: t('compFinancing'), cur: totals.financing, prev: prevData.totals.financing },
          { label: t('compNetFlow'), cur: totals.net, prev: prevData.totals.net },
        ]
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map(c => {
              const cmp = compareValues(c.cur, c.prev)
              return (
                <div key={c.label} className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</div>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <div className="font-mono text-lg font-bold">{fmtEur(Math.round(c.cur))}</div>
                      <div className="text-[10px] text-muted-foreground">{t('vsPrevious', { amount: fmtEur(Math.round(c.prev)), period: periodLabel.previous })}</div>
                    </div>
                    <div className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${cmp.positive ? 'text-success' : 'text-destructive'}`}>
                      {cmp.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {cmp.pct > 0 ? '+' : ''}{cmp.pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* KPIs: Operating / Investing / Financing / Net */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox label={t('kpiOperatingFlow')} value={`${totals.operating >= 0 ? '+' : ''}${fmtEur(Math.round(totals.operating))}`} icon={<Factory size={16} />} color={totals.operating >= 0 ? 'text-success' : 'text-destructive'} tooltip={t('kpiOperatingTooltip')} source={t('kpiOperatingSource')} />
        <KpiBox label={t('kpiInvestingFlow')} value={`${totals.investing >= 0 ? '+' : ''}${fmtEur(Math.round(totals.investing))}`} icon={<Building2 size={16} />} color={totals.investing >= 0 ? 'text-success' : 'text-destructive'} tooltip={t('kpiInvestingTooltip')} source={t('kpiInvestingSource')} />
        <KpiBox label={t('kpiFinancingFlow')} value={`${totals.financing >= 0 ? '+' : ''}${fmtEur(Math.round(totals.financing))}`} icon={<Landmark size={16} />} color={totals.financing >= 0 ? 'text-success' : 'text-destructive'} tooltip={t('kpiFinancingTooltip')} source={t('kpiFinancingSource')} />
        <KpiBox label={t('kpiNetFlow')} value={`${totals.net >= 0 ? '+' : ''}${fmtEur(Math.round(totals.net))}`} icon={<Banknote size={16} />} color={totals.net >= 0 ? 'text-success' : 'text-destructive'} highlight tooltip={t('kpiNetTooltip')} source={t('kpiNetSource')} />
      </div>

      {/* Monthly chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t('chartTitle')}</CardTitle>
            <Badge variant="secondary">{t('chartMonths', { count: months.length })}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v <= -1000 ? `${Math.round(v / 1000)}k` : String(v)} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--card-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                        labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                formatter={(v: number, name: string) => [fmtEur(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey={t('flowOperating')} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey={t('flowInvesting')} fill="hsl(var(--warning))" radius={[3, 3, 0, 0]} />
              <Bar dataKey={t('flowFinancing')} fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cash Flow Statement breakdown + Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Statement */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>{t('breakdownTitle')}</CardTitle>
              <div className="flex gap-1">
                {(['operating', 'investing', 'financing'] as const).map(t2 => (
                  <button
                    key={t2}
                    onClick={() => setDetailSection(t2)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${detailSection === t2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    {FLOW_TYPE_CONFIG[t2].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {detailCats.length > 0 ? detailCats.map(([cat, v]) => {
              const maxAbs = Math.max(...detailCats.map(([_, v]) => Math.abs(v.amount)))
              const pct = maxAbs > 0 ? (Math.abs(v.amount) / maxAbs) * 100 : 0
              return (
                <div key={cat} className="py-2 border-b border-border last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-[10px] text-muted-foreground">({t('movCount', { count: v.count })})</span>
                    </div>
                    <span className={`font-mono text-sm font-semibold ${v.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {v.amount >= 0 ? '+' : ''}{fmtEur(Math.round(v.amount))}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: v.amount >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
                      }}
                    />
                  </div>
                </div>
              )
            }) : (
              <div className="text-center py-6 text-sm text-muted-foreground">{t('noMovementsInCategory')}</div>
            )}
            {/* Subtotal */}
            {detailCats.length > 0 && (
              <div className="pt-2 mt-2 border-t-2 border-border flex items-center justify-between">
                <span className="text-sm font-semibold">{t('total')} {FLOW_TYPE_CONFIG[detailSection].label}</span>
                <span className={`font-mono text-base font-bold ${totals[detailSection] >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {totals[detailSection] >= 0 ? '+' : ''}{fmtEur(Math.round(totals[detailSection]))}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waterfall summary */}
        <Card>
          <CardHeader><CardTitle>{t('waterfallTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Operating breakdown */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Factory size={16} className="text-primary" />
                <span className="text-sm font-semibold">{t('operatingActivities')}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('categoryCustomerCollections')}</span><span className="font-mono font-semibold text-success">+{fmtEur(Math.round(operatingInflows))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('operatingPayments')}</span><span className="font-mono font-semibold text-destructive">{fmtEur(Math.round(operatingOutflows))}</span></div>
                <div className="flex justify-between border-t border-border pt-1.5"><span className="font-semibold">{t('netOperatingFlow')}</span><span className={`font-mono font-bold ${totals.operating >= 0 ? 'text-success' : 'text-destructive'}`}>{totals.operating >= 0 ? '+' : ''}{fmtEur(Math.round(totals.operating))}</span></div>
              </div>
            </div>

            {/* Investing */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-warning" />
                <span className="text-sm font-semibold">{t('investingActivities')}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {investingCats.map(([cat, v]) => (
                  <div key={cat} className="flex justify-between"><span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span><span className={`font-mono font-semibold ${v.amount >= 0 ? 'text-success' : 'text-destructive'}`}>{v.amount >= 0 ? '+' : ''}{fmtEur(Math.round(v.amount))}</span></div>
                ))}
                <div className="flex justify-between border-t border-border pt-1.5"><span className="font-semibold">{t('netInvestingFlow')}</span><span className={`font-mono font-bold ${totals.investing >= 0 ? 'text-success' : 'text-destructive'}`}>{totals.investing >= 0 ? '+' : ''}{fmtEur(Math.round(totals.investing))}</span></div>
              </div>
            </div>

            {/* Financing */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Landmark size={16} className="text-success" />
                <span className="text-sm font-semibold">{t('financingActivities')}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {financingCats.map(([cat, v]) => (
                  <div key={cat} className="flex justify-between"><span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span><span className={`font-mono font-semibold ${v.amount >= 0 ? 'text-success' : 'text-destructive'}`}>{v.amount >= 0 ? '+' : ''}{fmtEur(Math.round(v.amount))}</span></div>
                ))}
                {financingCats.length === 0 && <div className="text-muted-foreground">{t('noFinancingMovements')}</div>}
                <div className="flex justify-between border-t border-border pt-1.5"><span className="font-semibold">{t('netFinancingFlow')}</span><span className={`font-mono font-bold ${totals.financing >= 0 ? 'text-success' : 'text-destructive'}`}>{totals.financing >= 0 ? '+' : ''}{fmtEur(Math.round(totals.financing))}</span></div>
              </div>
            </div>

            {/* Grand total */}
            <div className={`p-4 rounded-lg border-2 ${totals.net >= 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote size={18} className={totals.net >= 0 ? 'text-success' : 'text-destructive'} />
                  <span className="font-semibold text-sm">{t('netCashVariation')}</span>
                </div>
                <span className={`font-mono text-xl font-bold ${totals.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {totals.net >= 0 ? '+' : ''}{fmtEur(Math.round(totals.net))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent movements table */}
      {(() => {
        const pageSize = 10
        const totalPages = Math.ceil(recentMovements.length / pageSize)
        const paged = recentMovements.slice(movPage * pageSize, (movPage + 1) * pageSize)
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>{t('recentMovements')}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('paginationOf', { from: movPage * pageSize + 1, to: Math.min((movPage + 1) * pageSize, recentMovements.length), total: recentMovements.length })}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={movPage === 0} onClick={() => setMovPage(p => p - 1)}>←</Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={movPage >= totalPages - 1} onClick={() => setMovPage(p => p + 1)}>→</Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('colDate'), t('colConcept'), t('colCounterparty'), t('colAccount'), t('colCategory'), t('colFlowType'), t('colAmount')].map(h => (
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m: any) => {
                    const flowCfg = FLOW_TYPE_CONFIG[m.flowType as keyof typeof FLOW_TYPE_CONFIG]
                    return (
                      <tr key={m.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</td>
                        <td className="p-3 text-xs max-w-[200px] truncate">{m.concept}</td>
                        <td className="p-3 text-xs text-muted-foreground">{m.counterparty || '—'}</td>
                        <td className="p-3 text-xs text-muted-foreground">{m.account}</td>
                        <td className="p-3"><Badge variant="secondary">{CATEGORY_LABELS[m.category] || m.category || t('categoryOther')}</Badge></td>
                        <td className="p-3"><Badge variant="outline" className="text-[10px]">{flowCfg?.label || m.flowType}</Badge></td>
                        <td className={`p-3 font-mono text-xs font-semibold ${m.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {m.amount >= 0 ? '+' : ''}{fmtEur(Math.round(m.amount))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollableTable>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 p-3 border-t border-border">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setMovPage(i)}
                    className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${movPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </Card>
        )
      })()}
    </div>
  )
}
