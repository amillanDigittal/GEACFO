'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { fmtEur, exportCSV } from '@/lib/utils'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Zap, CheckCircle2, TrendingUp, TrendingDown, FileDown } from 'lucide-react'
import { exportPagosPDF } from '@/lib/export-pdf-modules'
import { DateRangeSelector, type DateRange, compareValues } from '@/components/date-range-selector'
import dynamic from 'next/dynamic'

const DiscountCalculator = dynamic(() => import('./_components/discount-calculator').then(m => ({ default: m.DiscountCalculator })), { ssr: false })
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { ScrollableTable, Th } from '@/components/ui/scrollable-table'
import { TableFilters } from '@/components/table-filters'
import { exportXLSX } from '@/lib/export-xlsx'
import { VirtualTableBody } from '@/components/ui/virtual-table'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { useTranslations } from 'next-intl'

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function PagosPage() {
  const t = useTranslations('pagos')

  const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' }> = {
    IN_REVIEW: { label: t('statusInReview'), variant: 'warning' },
    APPROVED: { label: t('statusApproved'), variant: 'success' },
    PAID: { label: t('statusPaid'), variant: 'secondary' },
    REJECTED: { label: t('statusRejected'), variant: 'destructive' },
  }

  const priorityConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary' }> = {
    HIGH: { label: t('priorityHigh'), variant: 'destructive' },
    NORMAL: { label: t('priorityNormal'), variant: 'secondary' },
    LOW: { label: t('priorityLow'), variant: 'secondary' },
  }

  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [filterSupplier, setFilterSupplier] = useState('ALL')
  const [filterDueFrom, setFilterDueFrom] = useState('')
  const [filterDueTo, setFilterDueTo] = useState('')
  const [searchText, setSearchText] = useState('')
  const [sortBy, setSortBy] = useState<'dueDate' | 'totalAmount'>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [prevInvoices, setPrevInvoices] = useState<any[] | null>(null)
  const [periodLabel, setPeriodLabel] = useState<{ current: string; previous: string } | null>(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()
  const { toast } = useToast()

  useEffect(() => {
    api.treasury.ap()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  async function refresh() {
    try {
      const result = await api.treasury.ap(dateFrom, dateTo)
      setInvoices(result)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  async function handleDateRange(current: DateRange, previous: DateRange | null) {
    setLoading(true)
    try {
      const from = current.from || undefined, to = current.to || undefined
      setDateFrom(from); setDateTo(to)
      const result = await api.treasury.ap(from, to)
      setInvoices(result)
      if (previous?.from) {
        const prev = await api.treasury.ap(previous.from, previous.to)
        setPrevInvoices(prev)
        setPeriodLabel({ current: current.label, previous: previous.label })
      } else { setPrevInvoices(null); setPeriodLabel(null) }
    } catch (err) { console.error(err) }
    finally { setLoading(false); setLastUpdated(new Date()) }
  }

  const exportCsv = useCallback(() => {
    exportCSV('cuentas_por_pagar', [t('thInvoice'), t('thSupplier'), t('thDueDate'), t('thBase'), t('thTotal'), t('thPriority'), t('thStatus')], invoices.map((i: any) => [i.number, i.supplier?.name, i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), i.priority, i.status]))
  }, [invoices, t])

  useKeyboardShortcuts([
    { key: 'a', label: t('shortcutApprove'), action: () => { if (selected.size > 0 && !approving) handleApproveBatch() } },
    { key: 's', label: t('shortcutSelectAll'), action: () => toggleSelectAll() },
    { key: 'e', label: t('shortcutExport'), action: exportCsv },
    { key: 'r', label: t('shortcutRefresh'), action: refresh },
  ])

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={7} rows={6} />

  const filtered = invoices
    .filter((i: any) => {
      if (filter !== 'ALL' && i.status !== filter) return false
      if (filterPriority !== 'ALL' && i.priority !== filterPriority) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!i.number.toLowerCase().includes(q) && !i.supplier?.name?.toLowerCase().includes(q)) return false
      }
      if (filterSupplier !== 'ALL' && i.supplier?.id !== filterSupplier) return false
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

  const supplierOptions = Array.from(new Map(invoices.map((i: any) => [i.supplier?.id, { key: i.supplier?.id, label: i.supplier?.name }])).values()).filter(o => o.key)
  const pagosFilterCount = [filter !== 'ALL', filterPriority !== 'ALL', filterSupplier !== 'ALL', !!filterDueFrom, !!filterDueTo].filter(Boolean).length

  const totalPending = invoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const dueThisWeek = invoices.filter(i => { const d = daysUntil(i.dueDate); return d >= 0 && d <= 7 })
  const dueThisWeekAmount = dueThisWeek.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const approvedCount = invoices.filter(i => i.status === 'APPROVED').length
  const reviewCount = invoices.filter(i => i.status === 'IN_REVIEW').length
  const highPriority = invoices.filter(i => i.priority === 'HIGH')

  // By supplier
  const bySupplier: Record<string, { name: string; code: string; terms: number; total: number; count: number }> = {}
  invoices.forEach(i => {
    const s = i.supplier
    if (!bySupplier[s.id]) bySupplier[s.id] = { name: s.name, code: s.code, terms: s.paymentTerms, total: 0, count: 0 }
    bySupplier[s.id].total += Number(i.totalAmount) - Number(i.paidAmount)
    bySupplier[s.id].count++
  })

  // Payment calendar (next 4 weeks)
  const calendar: { week: string; amount: number; count: number; invoices: any[] }[] = []
  for (let w = 0; w < 4; w++) {
    const start = w * 7
    const end = (w + 1) * 7
    const weekInvoices = invoices.filter(i => {
      const d = daysUntil(i.dueDate)
      return d >= start && d < end
    })
    calendar.push({
      week: w === 0 ? t('calThisWeek') : w === 1 ? t('calNextWeek') : t('calWeekPlus', { n: w + 1 }),
      amount: weekInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0),
      count: weekInvoices.length,
      invoices: weekInvoices,
    })
  }

  function handleSort(col: 'dueDate' | 'totalAmount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'dueDate' ? 'asc' : 'desc') }
  }
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const reviewInvoices = filtered.filter((i: any) => i.status === 'IN_REVIEW')

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (reviewInvoices.every((i: any) => selected.has(i.id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(reviewInvoices.map((i: any) => i.id)))
    }
  }

  async function handleApprove(id: string) {
    setApproving(true)
    try {
      await api.treasury.approveAP(id)
      toast({ title: t('toastApprovedTitle'), description: t('toastApprovedDesc', { count: 1 }), variant: 'success' })
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
      const updated = await api.treasury.ap()
      setInvoices(updated)
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setApproving(false)
    }
  }

  async function handleApproveBatch() {
    const ids = [...selected]
    if (ids.length === 0) return
    setApproving(true)
    try {
      if (ids.length === 1) {
        await api.treasury.approveAP(ids[0])
      } else {
        await api.treasury.approveAPBatch(ids)
      }
      toast({ title: t('toastApprovedTitle'), description: t('toastApprovedDesc', { count: ids.length }) })
      setSelected(new Set())
      const updated = await api.treasury.ap()
      setInvoices(updated)
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setApproving(false)
    }
  }

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
            <Button variant="outline" size="sm" onClick={() => exportPagosPDF(invoices)}><FileDown size={14} className="mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV('cuentas_por_pagar', [t('thInvoice'), t('thSupplier'), t('thDueDate'), t('thBase'), t('thTotal'), t('thPriority'), t('thStatus')], invoices.map((i: any) => [i.number, i.supplier?.name, i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), i.priority, i.status]))}><Download size={14} className="mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportXLSX('cuentas_por_pagar', [t('thInvoice'), t('thSupplier'), t('thDueDate'), t('thBase'), t('thTotal'), t('thPriority'), t('thStatus')], invoices.map((i: any) => [i.number, i.supplier?.name, i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), i.priority, i.status]))}><Download size={14} className="mr-1" />Excel</Button>
          </div>
        }
      />

      {/* Alertas */}
      {highPriority.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <Zap size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('alertHighPriority', { count: highPriority.length })}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {highPriority.map(i => `${i.number} — ${i.supplier.name} (${fmtEur(Number(i.totalAmount))})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Period comparison */}
      {prevInvoices && periodLabel && (() => {
        const prevPending = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
        const prevTotal = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
        const curTotal = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
        const cmpTotal = compareValues(curTotal, prevTotal)
        const cmpPending = compareValues(totalPending, prevPending)
        const cmpCount = compareValues(invoices.length, prevInvoices.length)
        return (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('cmpTotalInvoices'), cur: fmtEur(curTotal), prev: fmtEur(prevTotal), ...cmpTotal },
              { label: t('cmpPendingPayment'), cur: fmtEur(totalPending), prev: fmtEur(prevPending), ...cmpPending },
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
        <KpiBox index={0} label={t('kpiTotalPending')} value={fmtEur(totalPending)} tooltip={t('kpiTotalPendingTooltip')} source={t('kpiTotalPendingSource')} />
        <KpiBox index={1} label={t('kpiDueThisWeek')} value={fmtEur(dueThisWeekAmount)} color={dueThisWeekAmount > 0 ? 'text-warning' : 'text-success'} tooltip={t('kpiDueThisWeekTooltip')} source={t('kpiDueThisWeekSource')} />
        <KpiBox index={2} label={t('kpiApproved')} value={`${approvedCount}`} color="text-success" tooltip={t('kpiApprovedTooltip')} source={t('kpiApprovedSource')} />
        <KpiBox index={3} label={t('kpiInReview')} value={`${reviewCount}`} color={reviewCount > 0 ? 'text-warning' : 'text-foreground'} tooltip={t('kpiInReviewTooltip')} source={t('kpiInReviewSource')} />
      </div>

      {/* Calendar + By Supplier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment calendar */}
        <Card>
          <CardHeader><CardTitle>{t('calendarTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {calendar.map(w => {
              const pct = totalPending > 0 ? (w.amount / totalPending) * 100 : 0
              const isUrgent = w.week === t('calThisWeek') && w.amount > 0
              return (
                <div key={w.week}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`font-medium ${isUrgent ? 'text-warning' : ''}`}>
                      {w.week} {isUrgent && <Zap size={12} className="inline" />} <span className="text-muted-foreground">({t('calInvCount', { count: w.count })})</span>
                    </span>
                    <span className={`font-mono font-semibold ${isUrgent ? 'text-warning' : 'text-foreground'}`}>
                      {w.amount > 0 ? fmtEur(w.amount) : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: isUrgent ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
                    }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* By Supplier */}
        <Card>
          <CardHeader><CardTitle>{t('bySupplierTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.values(bySupplier)
              .sort((a, b) => b.total - a.total)
              .map(s => {
                const pct = totalPending > 0 ? (s.total / totalPending) * 100 : 0
                return (
                  <div key={s.code} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        <Badge variant="secondary">{s.code}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{t('supplierInvoices', { count: s.count })} · {t('supplierTerms', { days: s.terms })}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-xs font-semibold">{fmtEur(s.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      </div>

      {/* Descuento por pronto pago */}
      <DiscountCalculator invoices={invoices} />

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>{t('invoiceDetailTitle')}</CardTitle>
            {selected.size > 0 && (
              <Button size="sm" onClick={handleApproveBatch} loading={approving}>
                {!approving && <CheckCircle2 size={14} className="mr-1" />}
                {approving ? t('approving') : t('approveCount', { count: selected.size })}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <TableFilters
            search={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder={t('searchPlaceholder')}
            statusOptions={[
              { key: 'ALL', label: t('filterAllStatuses') },
              { key: 'IN_REVIEW', label: t('filterInReview') },
              { key: 'APPROVED', label: t('filterApproved') },
              { key: 'PAID', label: t('filterPaid') },
              { key: 'REJECTED', label: t('filterRejected') },
            ]}
            status={filter}
            onStatusChange={setFilter}
            priorityOptions={[
              { key: 'ALL', label: t('filterAllPriorities') },
              { key: 'HIGH', label: t('priorityHigh') },
              { key: 'NORMAL', label: t('priorityNormal') },
              { key: 'LOW', label: t('priorityLow') },
            ]}
            priority={filterPriority}
            onPriorityChange={setFilterPriority}
            entityLabel={t('filterSupplierLabel')}
            entityOptions={supplierOptions}
            entity={filterSupplier}
            onEntityChange={setFilterSupplier}
            dueDateFrom={filterDueFrom}
            dueDateTo={filterDueTo}
            onDueDateFromChange={setFilterDueFrom}
            onDueDateToChange={setFilterDueTo}
            activeCount={pagosFilterCount}
            onClearAll={() => { setFilter('ALL'); setFilterPriority('ALL'); setSearchText(''); setFilterSupplier('ALL'); setFilterDueFrom(''); setFilterDueTo('') }}
          />
        </CardContent>
        <ScrollableTable label={t('invoiceDetailTableLabel')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-3 w-8">
                  {reviewInvoices.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label={t('selectAllReview')}
                      className="rounded border-border"
                      checked={reviewInvoices.length > 0 && reviewInvoices.every((i: any) => selected.has(i.id))}
                      onChange={toggleSelectAll}
                    />
                  )}
                </th>
                <Th>{t('thInvoice')}</Th>
                <Th>{t('thSupplier')}</Th>
                <Th sorted={sortBy === 'dueDate' ? sortDir : false} onSort={() => handleSort('dueDate')}>{t('thDueDate')}</Th>
                <Th>{t('thBase')}</Th>
                <Th sorted={sortBy === 'totalAmount' ? sortDir : false} onSort={() => handleSort('totalAmount')}>{t('thTotal')}</Th>
                <Th>{t('thPriority')}</Th>
                <Th>{t('thStatus')}</Th>
                <Th>{t('thTerm')}</Th>
                <Th>{t('thAction')}</Th>
              </tr>
            </thead>
          </table>
        </ScrollableTable>
        <VirtualTableBody
          data={filtered}
          getKey={(inv: any) => inv.id}
          rowClassName={(inv: any) => {
            const days = daysUntil(inv.dueDate)
            return selected.has(inv.id) ? 'bg-primary/5' : days < 0 ? 'bg-destructive/5' : days <= 3 && days >= 0 ? 'bg-warning/5' : ''
          }}
          renderRow={(inv: any) => {
            const stCfg = statusConfig[inv.status] || statusConfig.IN_REVIEW
            const priCfg = priorityConfig[inv.priority] || priorityConfig.NORMAL
            const days = daysUntil(inv.dueDate)
            const isUrgent = days <= 3 && days >= 0
            const isOverdue = days < 0
            return (
              <>
                <td className="p-3">
                  {inv.status === 'IN_REVIEW' && (
                    <input type="checkbox" aria-label={t('selectInvoice', { number: inv.number })} className="rounded border-border" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
                  )}
                </td>
                <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                <td className="p-3">
                  <div className="font-medium text-sm">{inv.supplier.name}</div>
                  <div className="text-xs text-muted-foreground">{inv.supplier.code}</div>
                </td>
                <td className="p-3">
                  <span className={`text-xs font-mono ${isOverdue ? 'text-destructive font-semibold' : isUrgent ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>{fmtDate(inv.dueDate)}</span>
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(Number(inv.amount))}</td>
                <td className={`p-3 font-mono text-xs font-semibold ${inv.status === 'PAID' ? 'text-success' : inv.status === 'REJECTED' ? 'text-muted-foreground' : 'text-destructive'}`}>{fmtEur(Number(inv.totalAmount))}</td>
                <td className="p-3"><Badge variant={priCfg.variant}>{priCfg.label}</Badge></td>
                <td className="p-3"><Badge variant={stCfg.variant}>{stCfg.label}</Badge></td>
                <td className="p-3">
                  {isOverdue ? (
                    <span className="font-mono text-xs font-bold text-destructive">{t('daysOverdue', { days: Math.abs(days) })}</span>
                  ) : (
                    <span className={`font-mono text-xs ${isUrgent ? 'font-bold text-warning' : 'text-muted-foreground'}`}>{days}d {isUrgent && <Zap size={12} className="inline" />}</span>
                  )}
                </td>
                <td className="p-3">
                  {inv.status === 'IN_REVIEW' && <Button variant="outline" size="sm" loading={approving} onClick={() => handleApprove(inv.id)}>{t('actionApprove')}</Button>}
                  {inv.status === 'APPROVED' && <span className="text-xs text-success font-medium">{t('readyForPayment')}</span>}
                </td>
              </>
            )
          }}
        />
      </Card>
    </div>
  )
}
