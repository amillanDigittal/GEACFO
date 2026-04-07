'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { fmtEur, exportCSV } from '@/lib/utils'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Zap, CheckCircle2, TrendingUp, TrendingDown, FileDown } from 'lucide-react'
import { exportPagosPDF } from '@/lib/export-pdf-modules'
import { DateRangeSelector, type DateRange, compareValues } from '@/components/date-range-selector'
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import dynamic from 'next/dynamic'

const DiscountCalculator = dynamic(() => import('./_components/discount-calculator').then(m => ({ default: m.DiscountCalculator })), { ssr: false })
import { PaymentCalendarCard } from './_components/payment-calendar-card'
import { BySupplierCard } from './_components/by-supplier-card'
import { PeriodComparison } from './_components/period-comparison'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { ScrollableTable, Th } from '@/components/ui/scrollable-table'
import { TableFilters } from '@/components/table-filters'
import { exportXLSX } from '@/lib/export-xlsx'
import { VirtualTableBody } from '@/components/ui/virtual-table'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { MobileCardView } from '@/components/ui/mobile-card-view'
import { useTranslations } from 'next-intl'
import { MiniSparkline } from '@/components/ui/mini-sparkline'

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function daysOverdue(dueDate: string): number {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
}

export default function PagosPage() {
  const t = useTranslations('pagos')

  function agingBucket(dueDate: string): string {
    const days = daysOverdue(dueDate)
    if (days < 0) return t('bucketCurrent')
    if (days <= 30) return '1-30d'
    if (days <= 60) return '31-60d'
    if (days <= 90) return '61-90d'
    return '>90d'
  }

  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

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

  const { filters, setFilters, clearFilters } = useUrlFilters({
    search: '',
    status: 'ALL',
    priority: 'ALL',
    supplier: 'ALL',
    dueFrom: '',
    dueTo: '',
    sortBy: 'dueDate',
    sortDir: 'asc',
  })

  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
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

  const approvalLevels = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('geacfo-approval-levels') || '[]') } catch { return [] } })()
    : []
  const enabledLevels = approvalLevels.filter((l: any) => l.enabled)

  function getRequiredLevel(amount: number): { role: string; label: string; level: number } | null {
    if (enabledLevels.length === 0) return null
    let requiredLevel = enabledLevels[0]
    let levelIdx = 0
    for (let i = 0; i < enabledLevels.length; i++) {
      if (amount >= enabledLevels[i].minAmount) {
        requiredLevel = enabledLevels[i]
        levelIdx = i
      }
    }
    return { role: requiredLevel.role, label: requiredLevel.label, level: levelIdx + 1 }
  }

  const filtered = invoices
    .filter((i: any) => {
      if (filters.status !== 'ALL' && i.status !== filters.status) return false
      if (filters.priority !== 'ALL' && i.priority !== filters.priority) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!i.number.toLowerCase().includes(q) && !i.supplier?.name?.toLowerCase().includes(q)) return false
      }
      if (filters.supplier !== 'ALL' && i.supplier?.id !== filters.supplier) return false
      if (filters.dueFrom && i.dueDate < filters.dueFrom) return false
      if (filters.dueTo && i.dueDate > filters.dueTo) return false
      return true
    })
    .sort((a: any, b: any) => {
      if (filters.sortBy === 'dueDate') {
        const da = new Date(a.dueDate).getTime(), db = new Date(b.dueDate).getTime()
        return filters.sortDir === 'asc' ? da - db : db - da
      }
      return filters.sortDir === 'desc' ? Number(b.totalAmount) - Number(a.totalAmount) : Number(a.totalAmount) - Number(b.totalAmount)
    })

  const supplierOptions = Array.from(new Map(invoices.map((i: any) => [i.supplier?.id, { key: i.supplier?.id, label: i.supplier?.name }])).values()).filter(o => o.key)
  const pagosFilterCount = [filters.status !== 'ALL', filters.priority !== 'ALL', filters.supplier !== 'ALL', !!filters.dueFrom, !!filters.dueTo].filter(Boolean).length

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

  // Aging bucket analysis
  const buckets: Record<string, { count: number; amount: number }> = {}
  filtered.filter((inv: any) => inv.status !== 'PAID').forEach((inv: any) => {
    const b = agingBucket(inv.dueDate)
    if (!buckets[b]) buckets[b] = { count: 0, amount: 0 }
    buckets[b].count++
    buckets[b].amount += Number(inv.totalAmount) - Number(inv.paidAmount || 0)
  })

  const BUCKET_ORDER = [t('bucketCurrent'), '1-30d', '31-60d', '61-90d', '>90d']
  const BUCKET_COLORS: Record<string, string> = {
    [t('bucketCurrent')]: 'hsl(var(--success))',
    '1-30d': 'hsl(var(--primary))',
    '31-60d': 'hsl(var(--warning))',
    '61-90d': 'hsl(var(--chart-blue, var(--primary)))',
    '>90d': 'hsl(var(--destructive))',
  }

  const bucketChartData = BUCKET_ORDER.map(b => ({
    bucket: b,
    amount: buckets[b]?.amount || 0,
    count: buckets[b]?.count || 0,
    color: BUCKET_COLORS[b] || 'hsl(var(--muted))',
  }))

  // Pie data for aging distribution
  const agingPieData = BUCKET_ORDER.filter(b => buckets[b]?.amount > 0).map(b => ({
    name: b,
    value: Math.round(buckets[b]?.amount || 0),
    fill: BUCKET_COLORS[b] || 'hsl(var(--muted))',
  }))

  // Supplier exposure for aging panel
  const supplierExposure = Object.values(bySupplier)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 8)

  // Sparkline data: last 8 invoices amounts per supplier for trend visualization
  const supplierSparklines: Record<string, number[]> = {}
  Object.entries(bySupplier).forEach(([id, s]: [string, any]) => {
    const suppInvoices = filtered.filter((inv: any) => inv.supplier?.id === id)
    supplierSparklines[id] = suppInvoices
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(-8)
      .map((inv: any) => Number(inv.totalAmount))
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
    if (filters.sortBy === col) setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })
    else { setFilters({ sortBy: col, sortDir: col === 'dueDate' ? 'asc' : 'desc' }) }
  }
  const sortIcon = (col: string) => filters.sortBy === col ? (filters.sortDir === 'desc' ? ' ↓' : ' ↑') : ''
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
      setFlashId(id); setTimeout(() => setFlashId(null), 1000)
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
      const updated = await api.treasury.ap()
      setInvoices(updated)
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setApproving(false)
    }
  }

  async function handleReject(id: string) {
    setApproving(true)
    try {
      await api.treasury.rejectAP(id)
      toast({ title: t('toastRejectedTitle'), description: t('toastRejectedDesc'), variant: 'destructive' })
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
      {prevInvoices && periodLabel && (
        <PeriodComparison invoices={invoices} prevInvoices={prevInvoices} periodLabel={periodLabel} totalPending={totalPending} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox index={0} label={t('kpiTotalPending')} value={fmtEur(totalPending)} tooltip={t('kpiTotalPendingTooltip')} source={t('kpiTotalPendingSource')} />
        <KpiBox index={1} label={t('kpiDueThisWeek')} value={fmtEur(dueThisWeekAmount)} color={dueThisWeekAmount > 0 ? 'text-warning' : 'text-success'} tooltip={t('kpiDueThisWeekTooltip')} source={t('kpiDueThisWeekSource')} />
        <KpiBox index={2} label={t('kpiApproved')} value={`${approvedCount}`} color="text-success" tooltip={t('kpiApprovedTooltip')} source={t('kpiApprovedSource')} />
        <KpiBox index={3} label={t('kpiInReview')} value={`${reviewCount}`} color={reviewCount > 0 ? 'text-warning' : 'text-foreground'} tooltip={t('kpiInReviewTooltip')} source={t('kpiInReviewSource')} />
      </div>

      {/* Aging Analysis */}
      {bucketChartData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>{t('agingTitle')}</CardTitle>
              {selectedBucket && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedBucket(null)}>
                  {t('agingClearFilter')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bar chart */}
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bucketChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: any) => [fmtEur(Number(v)), t('agingAmount')]} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => setSelectedBucket(prev => prev === d.bucket ? null : d.bucket)}>
                      {bucketChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} opacity={selectedBucket && selectedBucket !== entry.bucket ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Bucket summary pills */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {bucketChartData.map(b => (
                    <button
                      key={b.bucket}
                      onClick={() => setSelectedBucket(prev => prev === b.bucket ? null : b.bucket)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${
                        selectedBucket === b.bucket ? 'ring-2 ring-primary' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ borderColor: b.color, color: b.color, backgroundColor: `${b.color}10` }}
                    >
                      {b.bucket}: {b.count} ({fmtEur(b.amount)})
                    </button>
                  ))}
                </div>
              </div>
              {/* Pie chart + Supplier exposure */}
              <div>
                {agingPieData.length > 0 && (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={agingPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(d: any) => setSelectedBucket(d.name === selectedBucket ? null : d.name)}
                        cursor="pointer"
                      >
                        {agingPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} opacity={selectedBucket && selectedBucket !== entry.name ? 0.3 : 1} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [fmtEur(Number(v)), t('agingAmount')]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* By supplier */}
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-3 mb-2">{t('agingBySupplier')}</div>
                <div className="space-y-1.5">
                  {supplierExposure.map((s: any) => {
                    const pct = totalPending > 0 ? (s.total / totalPending) * 100 : 0
                    return (
                      <div key={s.code} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="font-mono font-semibold">{fmtEur(s.total)}</span>
                        <span className="text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bucket drill-down table */}
      {selectedBucket && (() => {
        const bucketInvs = filtered
          .filter((inv: any) => inv.status !== 'PAID' && agingBucket(inv.dueDate) === selectedBucket)
          .sort((a: any, b: any) => daysOverdue(b.dueDate) - daysOverdue(a.dueDate))
        const bucketTotal = bucketInvs.reduce((s: number, inv: any) => s + Number(inv.totalAmount) - Number(inv.paidAmount || 0), 0)
        return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: BUCKET_COLORS[selectedBucket] }} />
                <CardTitle className="text-sm">{t('agingDrilldown', { bucket: selectedBucket })}</CardTitle>
                <Badge variant="secondary">{bucketInvs.length} facturas</Badge>
              </div>
              <span className="font-mono text-sm font-bold">{fmtEur(bucketTotal)}</span>
            </div>
          </CardHeader>
          <ScrollableTable>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThInvoice')}</th>
                  <th className="text-left p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThSupplier')}</th>
                  <th className="text-right p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThDueDate')}</th>
                  <th className="text-right p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThDays')}</th>
                  <th className="text-right p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThPending')}</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThStatus')}</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold text-[10px] uppercase">{t('agingThPriority')}</th>
                </tr>
              </thead>
              <tbody>
                {bucketInvs.slice(0, 30).map((inv: any) => {
                  const stCfg = statusConfig[inv.status] || statusConfig.IN_REVIEW
                  const prCfg = priorityConfig[inv.priority] || priorityConfig.NORMAL
                  return (
                    <tr key={inv.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2.5 font-mono">{inv.number}</td>
                      <td className="p-2.5">{inv.supplier?.name || '—'}</td>
                      <td className="p-2.5 font-mono text-right">{new Date(inv.dueDate).toLocaleDateString('es-ES')}</td>
                      <td className="p-2.5 font-mono text-right" style={{ color: daysOverdue(inv.dueDate) > 60 ? 'hsl(var(--destructive))' : undefined }}>{daysOverdue(inv.dueDate)}d</td>
                      <td className="p-2.5 font-mono text-right">{fmtEur(Number(inv.totalAmount) - Number(inv.paidAmount || 0))}</td>
                      <td className="p-2.5 text-center"><Badge variant={stCfg.variant}>{stCfg.label}</Badge></td>
                      <td className="p-2.5 text-center"><Badge variant={prCfg.variant}>{prCfg.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
        )
      })()}

      {/* Calendar + By Supplier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentCalendarCard calendar={calendar} totalPending={totalPending} />
        <BySupplierCard bySupplier={bySupplier} totalPending={totalPending} />
      </div>

      {/* Descuento por pronto pago */}
      <DiscountCalculator invoices={invoices} />

      {/* Invoice cards (mobile) */}
      <MobileCardView
        data={filtered.slice(0, 50)}
        renderCard={(inv: any) => {
          const stCfg = statusConfig[inv.status] || statusConfig.IN_REVIEW
          const priCfg = priorityConfig[inv.priority] || priorityConfig.NORMAL
          const days = daysUntil(inv.dueDate)
          return {
            title: inv.number,
            subtitle: inv.supplier?.name,
            badge: { label: stCfg.label, variant: stCfg.variant },
            fields: [
              { label: t('thDueDate'), value: fmtDate(inv.dueDate) },
              { label: t('thTotal'), value: fmtEur(Number(inv.totalAmount)), highlight: true },
              { label: t('thPriority'), value: priCfg.label },
              { label: t('thTerm'), value: days < 0 ? `${Math.abs(days)}d ${t('daysOverdue', { days: Math.abs(days) }).split(' ').pop()}` : `${days}d` },
            ],
          }
        }}
      />

      {/* Invoice table (desktop) */}
      <Card className="hidden sm:block">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>{t('invoiceDetailTitle')}</CardTitle>
            {selected.size > 0 && (
              <Button size="sm" className="animate-scale-pop" onClick={handleApproveBatch} loading={approving}>
                {!approving && <CheckCircle2 size={14} className="mr-1" />}
                {approving ? t('approving') : t('approveCount', { count: selected.size })}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <TableFilters
            search={filters.search}
            onSearchChange={v => setFilters({ search: v })}
            searchPlaceholder={t('searchPlaceholder')}
            statusOptions={[
              { key: 'ALL', label: t('filterAllStatuses') },
              { key: 'IN_REVIEW', label: t('filterInReview') },
              { key: 'APPROVED', label: t('filterApproved') },
              { key: 'PAID', label: t('filterPaid') },
              { key: 'REJECTED', label: t('filterRejected') },
            ]}
            status={filters.status}
            onStatusChange={v => setFilters({ status: v })}
            priorityOptions={[
              { key: 'ALL', label: t('filterAllPriorities') },
              { key: 'HIGH', label: t('priorityHigh') },
              { key: 'NORMAL', label: t('priorityNormal') },
              { key: 'LOW', label: t('priorityLow') },
            ]}
            priority={filters.priority}
            onPriorityChange={v => setFilters({ priority: v })}
            entityLabel={t('filterSupplierLabel')}
            entityOptions={supplierOptions}
            entity={filters.supplier}
            onEntityChange={v => setFilters({ supplier: v })}
            dueDateFrom={filters.dueFrom}
            dueDateTo={filters.dueTo}
            onDueDateFromChange={v => setFilters({ dueFrom: v })}
            onDueDateToChange={v => setFilters({ dueTo: v })}
            activeCount={pagosFilterCount}
            onClearAll={clearFilters}
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
                <Th sorted={filters.sortBy === 'dueDate' ? filters.sortDir as 'asc' | 'desc' : false} onSort={() => handleSort('dueDate')}>{t('thDueDate')}</Th>
                <Th>{t('thBase')}</Th>
                <Th sorted={filters.sortBy === 'totalAmount' ? filters.sortDir as 'asc' | 'desc' : false} onSort={() => handleSort('totalAmount')}>{t('thTotal')}</Th>
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
            const flash = flashId === inv.id ? 'animate-flash-success' : ''
            const bg = selected.has(inv.id) ? 'bg-primary/5' : days < 0 ? 'bg-destructive/5' : days <= 3 && days >= 0 ? 'bg-warning/5' : ''
            return `${bg} ${flash}`.trim()
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
                  {supplierSparklines[inv.supplier?.id] && supplierSparklines[inv.supplier?.id].length >= 2 && (
                    <MiniSparkline data={supplierSparklines[inv.supplier?.id]} width={48} height={14} color="hsl(var(--primary))" className="mt-0.5" />
                  )}
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
                  {inv.status === 'IN_REVIEW' && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" loading={approving} onClick={() => handleApprove(inv.id)}>{t('actionApprove')}</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" loading={approving} onClick={() => handleReject(inv.id)}>{t('actionReject')}</Button>
                      {(() => {
                        const req = getRequiredLevel(Number(inv.totalAmount))
                        return req ? <Badge variant="outline" className="text-[9px] ml-1">{req.label}</Badge> : null
                      })()}
                    </div>
                  )}
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
