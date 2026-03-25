'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { useChartColors } from '@/hooks/use-chart-colors'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Siren, ChevronDown, FileDown, TrendingUp, TrendingDown } from 'lucide-react'
import { exportCobrosPDF } from '@/lib/export-pdf-modules'
import { DateRangeSelector, type DateRange, compareValues } from '@/components/date-range-selector'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { ScrollableTable, Th } from '@/components/ui/scrollable-table'
import { LazyChart } from '@/components/ui/lazy-chart'
import { TableFilters } from '@/components/table-filters'
import { exportXLSX } from '@/lib/export-xlsx'
import { VirtualTableBody } from '@/components/ui/virtual-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { useTranslations } from 'next-intl'

function daysDiff(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function CobrosPage() {
  const t = useTranslations('cobros')

  const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    PENDING: { label: t('statusPending'), variant: 'warning' },
    OVERDUE: { label: t('statusOverdue'), variant: 'destructive' },
    PAID: { label: t('statusPaid'), variant: 'success' },
    PARTIAL: { label: t('statusPartial'), variant: 'secondary' },
  }

  function agingBucket(dueDate: string): string {
    const days = daysDiff(dueDate)
    if (days < 0) return t('bucketCurrent')
    if (days <= 30) return '1-30d'
    if (days <= 60) return '31-60d'
    if (days <= 90) return '61-90d'
    return '>90d'
  }

  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'dueDate' | 'totalAmount'>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchText, setSearchText] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('ALL')
  const [filterDueFrom, setFilterDueFrom] = useState('')
  const [filterDueTo, setFilterDueTo] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [prevInvoices, setPrevInvoices] = useState<any[] | null>(null)
  const [periodLabel, setPeriodLabel] = useState<{ current: string; previous: string } | null>(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()
  const cc = useChartColors()

  useEffect(() => {
    api.treasury.ar()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  async function refresh() {
    try {
      const result = await api.treasury.ar(dateFrom, dateTo)
      setInvoices(result)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  async function handleDateRange(current: DateRange, previous: DateRange | null) {
    setLoading(true)
    try {
      const from = current.from || undefined
      const to = current.to || undefined
      setDateFrom(from)
      setDateTo(to)
      const result = await api.treasury.ar(from, to)
      setInvoices(result)
      if (previous && previous.from) {
        const prev = await api.treasury.ar(previous.from, previous.to)
        setPrevInvoices(prev)
        setPeriodLabel({ current: current.label, previous: previous.label })
      } else {
        setPrevInvoices(null)
        setPeriodLabel(null)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false); setLastUpdated(new Date()) }
  }

  const exportCsv = useCallback(() => {
    exportCSV('cuentas_por_cobrar', [t('thInvoice'), t('thClient'), t('thIssueDate'), t('thDueDate'), t('thBase'), t('thTotal'), t('thPaid'), t('thStatus')], invoices.map((i: any) => [i.number, i.customer?.name, i.issueDate?.slice(0, 10), i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), Number(i.paidAmount), i.status]))
  }, [invoices, t])

  useKeyboardShortcuts([
    { key: 'e', label: t('shortcutExport'), action: exportCsv },
    { key: 'r', label: t('shortcutRefresh'), action: refresh },
  ])

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={7} rows={6} />

  const filtered = invoices
    .filter((i: any) => {
      if (filter !== 'ALL' && i.status !== filter) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!i.number.toLowerCase().includes(q) && !i.customer?.name?.toLowerCase().includes(q)) return false
      }
      if (filterCustomer !== 'ALL' && i.customer?.id !== filterCustomer) return false
      if (filterDueFrom && i.dueDate < filterDueFrom) return false
      if (filterDueTo && i.dueDate > filterDueTo) return false
      return true
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'dueDate') {
        const da = new Date(a.dueDate).getTime(), db = new Date(b.dueDate).getTime()
        return sortDir === 'asc' ? da - db : db - da
      }
      return sortDir === 'desc' ? Number(b.totalAmount) - Number(a.totalAmount) : Number(a.totalAmount) - Number(b.totalAmount)
    })

  const customerOptions = Array.from(new Map(invoices.map((i: any) => [i.customer?.id, { key: i.customer?.id, label: i.customer?.name }])).values()).filter(o => o.key)
  const cobrosFilterCount = [filter !== 'ALL', filterCustomer !== 'ALL', !!filterDueFrom, !!filterDueTo].filter(Boolean).length

  const totalPending = invoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE')
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const pendingCount = invoices.filter(i => i.status === 'PENDING').length
  const overdueCount = overdueInvoices.length

  // Aging buckets
  const buckets: Record<string, { count: number; amount: number }> = {}
  invoices.forEach(i => {
    if (i.status === 'PAID') return
    const bucket = agingBucket(i.dueDate)
    if (!buckets[bucket]) buckets[bucket] = { count: 0, amount: 0 }
    buckets[bucket].count++
    buckets[bucket].amount += Number(i.totalAmount) - Number(i.paidAmount)
  })

  // By customer
  const byCustomer: Record<string, { name: string; code: string; score: number; risk: string; total: number; count: number }> = {}
  invoices.forEach(i => {
    const c = i.customer
    if (!byCustomer[c.id]) byCustomer[c.id] = { name: c.name, code: c.code, score: c.creditScore, risk: c.riskLevel, total: 0, count: 0 }
    byCustomer[c.id].total += Number(i.totalAmount) - Number(i.paidAmount)
    byCustomer[c.id].count++
  })

  function handleSort(col: 'dueDate' | 'totalAmount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'dueDate' ? 'asc' : 'desc') }
  }
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: invoices.length })}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <div className="flex gap-2">
            <DateRangeSelector onChange={handleDateRange} />
            <Button variant="outline" size="sm" onClick={() => exportCobrosPDF(invoices)}><FileDown size={14} className="mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV('cuentas_por_cobrar', [t('thInvoice'), t('thClient'), t('thIssueDate'), t('thDueDate'), t('thBase'), t('thTotal'), t('thPaid'), t('thStatus')], invoices.map((i: any) => [i.number, i.customer?.name, i.issueDate?.slice(0, 10), i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), Number(i.paidAmount), i.status]))}><Download size={14} className="mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportXLSX('cuentas_por_cobrar', [t('thInvoice'), t('thClient'), t('thIssueDate'), t('thDueDate'), t('thBase'), t('thTotal'), t('thPaid'), t('thStatus')], invoices.map((i: any) => [i.number, i.customer?.name, i.issueDate?.slice(0, 10), i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), Number(i.paidAmount), i.status]))}><Download size={14} className="mr-1" />Excel</Button>
          </div>
        }
      />

      {/* Alerta vencidas */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('alertOverdue', { count: overdueCount, amount: fmtEur(totalOverdue) })}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {overdueInvoices.map(i => `${i.number} (${i.customer.name})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Period comparison */}
      {prevInvoices && periodLabel && (() => {
        const prevPending = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
        const prevTotal = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
        const curTotal = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
        const cmpPending = compareValues(totalPending, prevPending)
        const cmpTotal = compareValues(curTotal, prevTotal)
        const cmpCount = compareValues(invoices.length, prevInvoices.length)
        return (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('cmpBilling'), cur: fmtEur(curTotal), prev: fmtEur(prevTotal), ...cmpTotal },
              { label: t('cmpPendingCollection'), cur: fmtEur(totalPending), prev: fmtEur(prevPending), ...cmpPending, positive: !cmpPending.positive },
              { label: t('cmpInvoiceCount'), cur: String(invoices.length), prev: String(prevInvoices.length), ...cmpCount },
            ].map(c => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</div>
                <div className="flex items-end justify-between mt-1">
                  <div>
                    <div className="font-mono text-lg font-bold">{c.cur}</div>
                    <div className="text-[10px] text-muted-foreground">vs {c.prev} ({periodLabel.previous})</div>
                  </div>
                  <div className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${c.positive ? 'text-success' : 'text-destructive'}`}>
                    {c.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {c.pct > 0 ? '+' : ''}{c.pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox label={t('kpiTotalPending')} value={fmtEur(totalPending)} tooltip={t('kpiTotalPendingTooltip')} source={t('kpiTotalPendingSource')} />
        <KpiBox label={t('kpiOverdue')} value={fmtEur(totalOverdue)} color={totalOverdue > 0 ? 'text-destructive' : 'text-success'} tooltip={t('kpiOverdueTooltip')} source={t('kpiOverdueSource')} />
        <KpiBox label={t('kpiPendingInvoices')} value={`${pendingCount + overdueCount}`} tooltip={t('kpiPendingInvoicesTooltip')} source={t('kpiPendingInvoicesSource')} />
        <KpiBox label={t('kpiAvgDso')} value={`${Math.round(invoices.reduce((s, i) => s + (i.customer?.dso || 0), 0) / (invoices.length || 1))}d`} tooltip={t('kpiAvgDsoTooltip')} source={t('kpiAvgDsoSource')} />
      </div>

      {/* Aging Report interactivo */}
      {(() => {
        const BUCKET_ORDER = [t('bucketCurrent'), '1-30d', '31-60d', '61-90d', '>90d']
        const BUCKET_COLORS: Record<string, string> = {
          [t('bucketCurrent')]: cc.success,
          '1-30d': cc.primary,
          '31-60d': cc.warning,
          '61-90d': cc.chartBlue,
          '>90d': cc.destructive,
        }

        // Aging by customer (for stacked chart)
        const customerNames = [...new Set(invoices.filter(i => i.status !== 'PAID').map(i => i.customer.name))]
        const agingByCustomer = BUCKET_ORDER.map(bucket => {
          const entry: any = { bucket }
          customerNames.forEach(name => { entry[name] = 0 })
          invoices.forEach(i => {
            if (i.status === 'PAID') return
            if (agingBucket(i.dueDate) === bucket) {
              entry[i.customer.name] = (entry[i.customer.name] || 0) + Number(i.totalAmount) - Number(i.paidAmount)
            }
          })
          return entry
        })

        // Chart data for simple bar
        const chartData = BUCKET_ORDER.map(bucket => ({
          bucket,
          amount: buckets[bucket]?.amount || 0,
          count: buckets[bucket]?.count || 0,
          color: BUCKET_COLORS[bucket],
        }))

        // Pie data
        const pieData = BUCKET_ORDER.filter(b => buckets[b]?.amount > 0).map(bucket => ({
          name: bucket,
          value: Math.round(buckets[bucket]?.amount || 0),
          fill: BUCKET_COLORS[bucket],
        }))

        // Invoices for selected bucket
        const bucketInvoices = selectedBucket
          ? invoices.filter(i => i.status !== 'PAID' && agingBucket(i.dueDate) === selectedBucket)
              .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
          : []

        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bar chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle>{t('agingTitle')}</CardTitle>
                    {selectedBucket && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedBucket(null)}>
                        {t('agingClearSelection')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <LazyChart height={240}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: cc.mutedForeground }} />
                      <YAxis tick={{ fontSize: 10, fill: cc.mutedForeground }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                      <Tooltip
                        contentStyle={{ background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 8, fontSize: 12, color: cc.cardForeground }}
                        itemStyle={{ color: cc.cardForeground }}
                        labelStyle={{ color: cc.cardForeground }}
                        formatter={(v: number) => [fmtEur(v), t('tooltipAmount')]}
                        labelFormatter={l => `${t('tooltipBracket')}: ${l}`}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(data: any) => setSelectedBucket(data.bucket === selectedBucket ? null : data.bucket)}>
                        {chartData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.color}
                            opacity={selectedBucket && selectedBucket !== entry.bucket ? 0.3 : 1}
                            stroke={selectedBucket === entry.bucket ? cc.foreground : 'none'}
                            strokeWidth={selectedBucket === entry.bucket ? 2 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  </LazyChart>
                  {/* Bucket summary row */}
                  <div className="flex gap-2 mt-3">
                    {BUCKET_ORDER.map(bucket => {
                      const b = buckets[bucket]
                      const isActive = selectedBucket === bucket
                      return (
                        <button
                          key={bucket}
                          onClick={() => setSelectedBucket(isActive ? null : bucket)}
                          className={`flex-1 p-2 rounded-lg border text-center transition-all ${isActive ? 'border-foreground bg-muted' : 'border-border hover:border-foreground/30'}`}
                        >
                          <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: BUCKET_COLORS[bucket] }} />
                          <div className="text-[10px] text-muted-foreground">{bucket}</div>
                          <div className="font-mono text-xs font-bold">{b ? fmtEur(b.amount) : '—'}</div>
                          <div className="text-[9px] text-muted-foreground">{b ? t('agingInvCount', { count: b.count }) : '0'}</div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Pie + Customer exposure */}
              <Card>
                <CardHeader><CardTitle>{t('distributionTitle')}</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <LazyChart height={160}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          onClick={(data: any) => setSelectedBucket(data.name === selectedBucket ? null : data.name)}
                          cursor="pointer"
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} opacity={selectedBucket && selectedBucket !== entry.name ? 0.3 : 1} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 8, fontSize: 11, color: cc.cardForeground }}
                          itemStyle={{ color: cc.cardForeground }}
                          labelStyle={{ color: cc.cardForeground }}
                          formatter={(v: number) => [fmtEur(v), t('tooltipAmount')]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    </LazyChart>
                  ) : (
                    <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">{t('noData')}</div>
                  )}
                  {/* By customer */}
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-3 mb-2">{t('byClientTitle')}</div>
                  <div className="space-y-2">
                    {Object.values(byCustomer)
                      .sort((a, b) => b.total - a.total)
                      .map(c => {
                        const pct = totalPending > 0 ? (c.total / totalPending) * 100 : 0
                        return (
                          <div key={c.code} className="flex items-center gap-2 text-xs">
                            <Badge variant={riskVariant(c.risk)} className="text-[9px]">{riskLabel(c.risk)}</Badge>
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="font-mono font-semibold">{fmtEur(c.total)}</span>
                            <span className="text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Drill-down: selected bucket invoices */}
            {selectedBucket && bucketInvoices.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: BUCKET_COLORS[selectedBucket] }} />
                      <CardTitle>{t('bucketInvoicesTitle', { bucket: selectedBucket })}</CardTitle>
                      <Badge variant="secondary">{t('bucketInvoicesCount', { count: bucketInvoices.length })}</Badge>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {fmtEur(bucketInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0))}
                    </span>
                  </div>
                </CardHeader>
                <ScrollableTable label={t('bucketInvoicesTableLabel')}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {[t('thInvoice'), t('thClient'), t('thDueDate'), t('thDays'), t('thPending'), t('thStatus')].map(h => (
                          <Th key={h}>{h}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bucketInvoices.map(inv => {
                        const days = daysDiff(inv.dueDate)
                        const pending = Number(inv.totalAmount) - Number(inv.paidAmount)
                        const cfg = statusConfig[inv.status] || statusConfig.PENDING
                        return (
                          <tr key={inv.id} className="border-b border-border hover:bg-muted/50">
                            <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                            <td className="p-3">
                              <div className="text-sm font-medium">{inv.customer.name}</div>
                              <div className="text-xs text-muted-foreground">{inv.customer.code} · Score: {inv.customer.creditScore}</div>
                            </td>
                            <td className="p-3 font-mono text-xs text-muted-foreground">{fmtDate(inv.dueDate)}</td>
                            <td className="p-3">
                              <span className={`font-mono text-xs font-bold ${days > 60 ? 'text-destructive' : days > 0 ? 'text-warning' : 'text-success'}`}>
                                {days > 0 ? t('daysOverdue', { days }) : days === 0 ? t('daysToday') : t('daysRemaining', { days: Math.abs(days) })}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-xs font-semibold">{fmtEur(pending)}</td>
                            <td className="p-3"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ScrollableTable>
              </Card>
            )}
          </>
        )
      })()}

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceDetailTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <TableFilters
            search={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder={t('searchPlaceholder')}
            statusOptions={[
              { key: 'ALL', label: t('filterAllStatuses') },
              { key: 'OVERDUE', label: t('filterOverdue') },
              { key: 'PENDING', label: t('filterPending') },
              { key: 'PAID', label: t('filterPaid') },
            ]}
            status={filter}
            onStatusChange={setFilter}
            entityLabel={t('filterClientLabel')}
            entityOptions={customerOptions}
            entity={filterCustomer}
            onEntityChange={setFilterCustomer}
            dueDateFrom={filterDueFrom}
            dueDateTo={filterDueTo}
            onDueDateFromChange={setFilterDueFrom}
            onDueDateToChange={setFilterDueTo}
            activeCount={cobrosFilterCount}
            onClearAll={() => { setFilter('ALL'); setSearchText(''); setFilterCustomer('ALL'); setFilterDueFrom(''); setFilterDueTo('') }}
          />
        </CardContent>
        <ScrollableTable label={t('invoiceDetailTableLabel')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th>{t('thInvoice')}</Th>
                <Th>{t('thClient')}</Th>
                <Th>{t('thIssueDate')}</Th>
                <Th sorted={sortBy === 'dueDate' ? sortDir : false} onSort={() => handleSort('dueDate')}>{t('thDueDate')}</Th>
                <Th>{t('thBase')}</Th>
                <Th sorted={sortBy === 'totalAmount' ? sortDir : false} onSort={() => handleSort('totalAmount')}>{t('thTotal')}</Th>
                <Th>{t('thPaid')}</Th>
                <Th>{t('thStatus')}</Th>
                <Th>{t('thAging')}</Th>
              </tr>
            </thead>
          </table>
        </ScrollableTable>
        <VirtualTableBody
          data={filtered}
          getKey={(inv: any) => inv.id}
          rowClassName={(inv: any) => inv.status === 'OVERDUE' ? 'bg-destructive/5' : ''}
          renderRow={(inv: any) => {
            const cfg = statusConfig[inv.status] || statusConfig.PENDING
            const overdueDays = inv.status === 'OVERDUE' ? daysDiff(inv.dueDate) : 0
            return (
              <>
                <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                <td className="p-3">
                  <div className="font-medium text-sm">{inv.customer.name}</div>
                  <div className="text-xs text-muted-foreground">{inv.customer.code}</div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(inv.issueDate)}</td>
                <td className="p-3">
                  <span className={`text-xs font-mono ${inv.status === 'OVERDUE' ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{fmtDate(inv.dueDate)}</span>
                </td>
                <td className="p-3 font-mono text-xs">{fmtEur(Number(inv.amount))}</td>
                <td className="p-3 font-mono text-xs font-semibold">{fmtEur(Number(inv.totalAmount))}</td>
                <td className="p-3 font-mono text-xs">
                  {Number(inv.paidAmount) > 0 ? <span className="text-success">{fmtEur(Number(inv.paidAmount))}</span> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                <td className="p-3">
                  {inv.status === 'OVERDUE' ? (
                    <span className="font-mono text-xs font-bold text-destructive">{t('daysOverdue', { days: overdueDays })}</span>
                  ) : inv.status === 'PENDING' ? (
                    <span className="font-mono text-xs text-muted-foreground">{daysDiff(inv.dueDate) < 0 ? t('daysRemaining', { days: Math.abs(daysDiff(inv.dueDate)) }) : t('daysToday')}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </>
            )
          }}
        />
      </Card>
    </div>
  )
}
