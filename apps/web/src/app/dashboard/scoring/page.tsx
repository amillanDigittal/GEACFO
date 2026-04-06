'use client'
import { Fragment, useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { useCustomers, useCustomer } from '@/hooks/use-api'
import { fmtEur, scoreColor, riskLabel, riskVariant } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KpiBox } from '@/components/kpi-box'
import { RefreshCw, Siren, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import { exportScoringPDF } from '@/lib/export-pdf-modules'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { MiniSparkline } from '@/components/ui/mini-sparkline'
import { PageHeader } from '@/components/page-header'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function ScoringPage() {
  const t = useTranslations('scoring')
  const { data: customers = [], mutate, isLoading: loading } = useCustomers()
  const [recalculating, setRecalculating] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { filters: urlFilters, setFilters: setUrlFilters } = useUrlFilters({ page: '0' })
  const page = parseInt(urlFilters.page) || 0
  const setPage = (v: number | ((p: number) => number)) => {
    const next = typeof v === 'function' ? v(page) : v
    setUrlFilters({ page: String(next) })
  }
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const { data: historyData, isLoading: historyLoading } = useCustomer(expandedId)

  async function recalculate(id: string) {
    setRecalculating(prev => new Set(prev).add(id))
    try {
      await api.customers.recalculate(id)
      await mutate()
    } catch (e) { console.error(e) }
    finally { setRecalculating(prev => { const next = new Set(prev); next.delete(id); return next }) }
  }

  function toggleHistory(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
  }

  useKeyboardShortcuts([
    { key: 'r', label: t('shortcutRefresh'), action: () => { mutate() } },
  ])

  const hydrated = useHydrated()

  useEffect(() => {
    if (customers.length > 0 && !loading) setLastUpdated(new Date())
  }, [customers, loading])

  const kpiData = useMemo(() => {
    const totalExposure = customers.reduce((sum: number, c: any) => {
      const pending = c.invoices?.reduce((s: number, i: any) =>
        i.status !== 'PAID' ? s + Number(i.totalAmount) - Number(i.paidAmount) : s, 0) || 0
      return sum + pending
    }, 0)

    const validScores = customers.filter((c: any) => c.creditScore != null)
    const avgScore = validScores.length > 0
      ? validScores.reduce((s: number, c: any) => s + c.creditScore, 0) / validScores.length
      : 0

    const highRisk = customers.filter((c: any) =>
      c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL'
    ).length

    const validDso = customers.filter((c: any) => c.dso != null && c.dso > 0)
    const avgDso = validDso.length > 0
      ? Math.round(validDso.reduce((s: number, c: any) => s + (c.dso || 0), 0) / validDso.length)
      : 0

    return { totalExposure, avgScore, highRisk, avgDso }
  }, [customers])

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={8} rows={6} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={() => mutate()}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportScoringPDF(customers)}><FileDown size={14} className="mr-1" />PDF</Button>
        }
      />

      {kpiData.highRisk > 0 && (
        <div className="flex gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div><div className="font-semibold text-sm">{t('alertActive')}</div>
          <div className="text-xs opacity-80 mt-0.5">{t('alertActiveDetail')}</div></div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox index={0} label={t('kpiTotalExposure')} value={fmtEur(kpiData.totalExposure)} />
        <KpiBox index={1} label={t('kpiAverageScore')} value={kpiData.avgScore.toFixed(1)} color={kpiData.avgScore >= 70 ? 'text-success' : kpiData.avgScore >= 50 ? 'text-warning' : 'text-destructive'} />
        <KpiBox index={2} label={t('kpiHighRisk')} value={`${kpiData.highRisk}`} color={kpiData.highRisk > 0 ? 'text-destructive' : 'text-success'} />
        <KpiBox index={3} label={t('kpiAverageDso')} value={`${kpiData.avgDso}d`} color={kpiData.avgDso > 60 ? 'text-destructive' : kpiData.avgDso > 45 ? 'text-warning' : 'text-success'} />
      </div>

      <Card>
        <CardHeader><CardTitle>{t('customerPortfolio')}</CardTitle></CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{[t('thClient'), t('thScoreAi'), t('thRisk'), t('thExposure'), t('thDso'), t('thLimit'), t('thStatus'), t('thAction')].map(h => <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {customers.slice(page * 10, (page + 1) * 10).map(c => {
                const isExpanded = expandedId === c.id
                const scoreColorVal = c.creditScore >= 80 ? 'hsl(var(--success))' : c.creditScore >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
                return (
                <Fragment key={c.id}>
                <tr className={`border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/50' : ''}`} onClick={() => toggleHistory(c.id)}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.code}</div></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16"><div className="h-full rounded-full transition-all" style={{ width: `${c.creditScore}%`, background: scoreColorVal }} /></div>
                      <span className="font-mono text-xs font-bold" style={{ color: scoreColorVal }}>{c.creditScore}</span>
                      <MiniSparkline
                        data={c.scoreHistory?.map((h: any) => h.score) || [c.creditScore, c.creditScore]}
                        color={scoreColorVal}
                        width={40}
                        height={14}
                      />
                    </div>
                  </td>
                  <td className="p-3"><Badge variant={riskVariant(c.riskLevel)}>{riskLabel(c.riskLevel)}</Badge></td>
                  <td className="p-3 font-mono text-xs">{fmtEur(c.invoices?.reduce((s: number, i: any) => s + Number(i.totalAmount), 0) || 0)}</td>
                  <td className="p-3 font-mono text-xs" style={{ color: c.dso > 60 ? 'hsl(var(--destructive))' : c.dso > 45 ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>{c.dso}d</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(Number(c.creditLimit))}</td>
                  <td className="p-3"><Badge variant={c.status === 'ALERT' ? 'destructive' : 'success'}>{c.status === 'ALERT' ? t('statusAlert') : t('statusActive')}</Badge></td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); recalculate(c.id) }} disabled={recalculating.has(c.id)}>
                      <RefreshCw size={13} className={`mr-1 ${recalculating.has(c.id) ? 'animate-spin' : ''}`} />
                      {recalculating.has(c.id) ? t('calculating') : t('recalculate')}
                    </Button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border">
                    <td colSpan={8} className="p-0">
                      <div className="bg-muted/30 p-5">
                        {historyLoading ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">{t('loadingHistory')}</div>
                        ) : historyData?.scoreHistory?.length > 0 ? (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t('scoreEvolution', { name: historyData.name })}</div>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={historyData.scoreHistory.map((h: any) => ({
                                  date: new Date(h.calculatedAt).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
                                  score: h.score,
                                  riskLevel: h.riskLevel,
                                }))}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                                  <ReferenceLine y={80} stroke="hsl(var(--success))" strokeDasharray="3 3" label={{ value: t('lowRisk'), position: 'right', fontSize: 9, fill: 'hsl(var(--success))' }} />
                                  <ReferenceLine y={60} stroke="hsl(var(--warning))" strokeDasharray="3 3" label={{ value: t('medium'), position: 'right', fontSize: 9, fill: 'hsl(var(--warning))' }} />
                                  <Tooltip
                                    formatter={(v: any) => [`${v} pts`, 'Score']}
                                   
                                  />
                                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t('factorsLastCalc')}</div>
                              {(() => {
                                const last = historyData.scoreHistory[historyData.scoreHistory.length - 1]
                                const factors = last?.factors || {}
                                const labels: Record<string, string> = { paymentHistory: t('factorPaymentHistory'), dsoTrend: t('factorDsoTrend'), seniority: t('factorSeniority'), financialCapacity: t('factorFinancialCapacity') }
                                return (
                                  <div className="space-y-3">
                                    {Object.entries(labels).map(([key, label]) => {
                                      const val = factors[key] || 0
                                      return (
                                        <div key={key}>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-mono font-semibold" style={{ color: val >= 75 ? 'hsl(var(--success))' : val >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>{val}</span>
                                          </div>
                                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: val >= 75 ? 'hsl(var(--success))' : val >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} />
                                          </div>
                                        </div>
                                      )
                                    })}
                                    {/* Detail metrics from real calculation */}
                                    {factors._detail && (
                                      <div className="pt-2 mt-2 border-t border-border space-y-1.5">
                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{t('baseMetrics')}</div>
                                        {[
                                          { label: t('metricTotalInvoices'), value: factors._detail.totalInvoices },
                                          { label: t('metricPaid'), value: factors._detail.paidCount, color: 'text-success' },
                                          { label: t('metricOverdue'), value: factors._detail.overdueCount, color: factors._detail.overdueCount > 0 ? 'text-destructive' : 'text-success' },
                                          { label: t('metricRealDso'), value: `${factors._detail.realDSO}d`, color: factors._detail.realDSO > factors._detail.dsoTarget ? 'text-destructive' : 'text-success' },
                                          { label: t('metricTargetDso'), value: `${factors._detail.dsoTarget}d` },
                                          { label: t('metricSeniority'), value: t('metricSeniorityValue', { months: factors._detail.customerAgeMonths }) },
                                          ...(factors._detail.creditUtilization != null ? [{ label: t('metricCreditUsage'), value: `${factors._detail.creditUtilization}%`, color: factors._detail.creditUtilization > 80 ? 'text-destructive' : factors._detail.creditUtilization > 50 ? 'text-warning' : 'text-success' }] : []),
                                          { label: t('metricExposure'), value: `${factors._detail.totalOutstanding?.toLocaleString('es-ES')} \u20AC` },
                                        ].map(m => (
                                          <div key={m.label} className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">{m.label}</span>
                                            <span className={`font-mono font-semibold ${(m as any).color || ''}`}>{m.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="pt-2 mt-2 border-t border-border">
                                      <div className="text-[10px] text-muted-foreground">
                                        {t('recordsSince', { count: historyData.scoreHistory.length, date: new Date(historyData.scoreHistory[0].calculatedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) })}
                                        {factors._detail && <span> · {t('weights')}</span>}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-sm text-muted-foreground">{t('noHistory')}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
</ScrollableTable>
        {customers.length > 10 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{'\u2190'}</Button>
            {Array.from({ length: Math.ceil(customers.length / 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= Math.ceil(customers.length / 10) - 1} onClick={() => setPage(p => p + 1)}>{'\u2192'}</Button>
            <span className="text-xs text-muted-foreground ml-2">{page * 10 + 1}{'\u2013'}{Math.min((page + 1) * 10, customers.length)} {t('of')} {customers.length}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
